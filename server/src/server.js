import { connectDB } from "./config/database.js";
import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import app from "./app.js";
import registerRoomSocket from "./sockets/room.socket.js";
import { SOCKET_EVENTS } from "./constants/socketEvents.js";

dotenv.config();

// Connect to MongoDB before starting the server
await connectDB();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`socket connected: ${socket.id}`);
  registerRoomSocket(io, socket);
});

// Collaborative Workspace WebSocket room storage and setup
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    const yDoc = new Y.Doc();
    
    // Initialize with default template text if empty
    const yText = yDoc.getText("codestate");
    if (yText.toString() === "") {
      yText.insert(0, `// Welcome to the Real-time Collaborative Workspace!
// Room ID: ${roomId}
// Start collaborating with your team in real time!

function greetUser(name) {
  console.log("Hello, " + name + "!");
  return "Welcome to the collaborative board!";
}

greetUser("Collaborator");
`);
    }

    rooms.set(roomId, {
      yDoc,
      strokes: [],
      users: new Map(),
      sockets: new Map()
    });
  }
  return rooms.get(roomId);
}

// Attach raw WebSocket server on the same HTTP server
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  // Let Socket.io handle its own handshake requests (usually starts with /socket.io)
  if (!pathname.startsWith("/socket.io")) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

wss.on("connection", (ws, req) => {
  let currentRoomId = "default";
  let currentUserId = "";

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case "join": {
          const { roomId, userName, userColor, userId } = data.payload;
          currentRoomId = roomId || "default";
          currentUserId = userId;

          const room = getOrCreateRoom(currentRoomId);
          
          room.users.set(userId, {
            id: userId,
            name: userName,
            color: userColor
          });
          room.sockets.set(userId, ws);

          console.log(`User ${userName} (${userId}) joined room ${currentRoomId} via WebSocket`);

          // 1. Send the newly joined client the current full Yjs doc state as an update
          const docState = Y.encodeStateAsUpdate(room.yDoc);
          const docUpdateHex = Buffer.from(docState).toString("hex");

          ws.send(JSON.stringify({
            type: "init:code",
            payload: {
              update: docUpdateHex
            }
          }));

          // 2. Send current whiteboard strokes
          ws.send(JSON.stringify({
            type: "init:whiteboard",
            payload: {
              strokes: room.strokes
            }
          }));

          // 3. Broadcast updated active users list to everyone in the room
          broadcastUserList(currentRoomId);
          break;
        }

        case "whiteboard:stroke": {
          const room = rooms.get(currentRoomId);
          if (room) {
            const stroke = data.payload.stroke;
            room.strokes.push(stroke);
            
            // Broadcast stroke to other users in the room
            broadcastToRoom(currentRoomId, currentUserId, {
              type: "whiteboard:stroke",
              payload: { stroke }
            });
          }
          break;
        }

        case "whiteboard:clear": {
          const room = rooms.get(currentRoomId);
          if (room) {
            room.strokes = [];
            broadcastToRoom(currentRoomId, null, {
              type: "whiteboard:clear"
            });
          }
          break;
        }

        case "code:update": {
          const room = rooms.get(currentRoomId);
          if (room) {
            const { update } = data.payload;
            const updateBuffer = Buffer.from(update, "hex");
            
            // Apply Yjs update to server's in-memory doc
            Y.applyUpdate(room.yDoc, updateBuffer);

            // Broadcast update to all other connections in this room
            broadcastToRoom(currentRoomId, currentUserId, {
              type: "code:update",
              payload: { update }
            });
          }
          break;
        }

        case "cursor:move": {
          const room = rooms.get(currentRoomId);
          if (room) {
            const user = room.users.get(currentUserId);
            if (user) {
              user.cursor = data.payload.cursor;
              
              // Broadcast cursor moving to all other users in the room
              broadcastToRoom(currentRoomId, currentUserId, {
                type: "cursor:move",
                payload: {
                  userId: currentUserId,
                  cursor: data.payload.cursor
                }
              });
            }
          }
          break;
        }

        case "message:send": {
          const room = rooms.get(currentRoomId);
          if (room) {
            // Send collaborative action log to the entire room
            const { message: logMessage, userName, userColor } = data.payload;
            broadcastToRoom(currentRoomId, null, {
              type: "message:recv",
              payload: {
                id: Math.random().toString(36).substring(7),
                timestamp: new Date().toLocaleTimeString(),
                userName,
                userColor,
                text: logMessage
              }
            });
          }
          break;
        }
      }
    } catch (err) {
      console.error("Error processing WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    console.log(`WebSocket closed for User ${currentUserId} in Room ${currentRoomId}`);
    const room = rooms.get(currentRoomId);
    if (room) {
      room.users.delete(currentUserId);
      room.sockets.delete(currentUserId);
      
      // If room is completely empty, clean it up after a delay
      if (room.users.size === 0) {
        setTimeout(() => {
          const r = rooms.get(currentRoomId);
          if (r && r.users.size === 0) {
            rooms.delete(currentRoomId);
            console.log(`Cleaned up empty room ${currentRoomId}`);
          }
        }, 30000); // 30 seconds delay
      } else {
        // Broadcast updated user list to remaining users
        broadcastUserList(currentRoomId);
      }
    }
  });

  ws.on("error", (err) => {
    console.error(`WebSocket error for User ${currentUserId}:`, err);
  });
});

function broadcastUserList(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    const usersList = Array.from(room.users.values());
    const payload = JSON.stringify({
      type: "users:list",
      payload: { users: usersList }
    });
    room.sockets.forEach((socket) => {
      if (socket.readyState === 1) { // 1 = OPEN
        socket.send(payload);
      }
    });
  }
}

function broadcastToRoom(roomId, excludeUserId, messageObj) {
  const room = rooms.get(roomId);
  if (room) {
    const payload = JSON.stringify(messageObj);
    room.sockets.forEach((socket, userId) => {
      if (userId !== excludeUserId && socket.readyState === 1) {
        socket.send(payload);
      }
    });
  }
}

server.listen(PORT, () => {
  console.log(`syncspace server is running on port ${PORT}`);
});
