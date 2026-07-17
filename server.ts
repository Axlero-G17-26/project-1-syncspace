import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import { createServer as createViteServer } from "vite";

interface User {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number; element?: "whiteboard" | "editor"; line?: number; ch?: number };
}

interface RoomState {
  yDoc: Y.Doc;
  strokes: any[];
  users: Map<string, User>;
  sockets: Map<string, WebSocket>;
}

const rooms = new Map<string, RoomState>();

// Helper to get or create room state
function getOrCreateRoom(roomId: string): RoomState {
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
  return rooms.get(roomId)!;
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", roomsActive: rooms.size });
  });

  // Attach WebSocket server on the same HTTP server
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, req) => {
    let currentRoomId = "default";
    let currentUserId = "";

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case "join": {
            const { roomId, userName, userColor, userId } = data.payload;
            currentRoomId = roomId || "default";
            currentUserId = userId;

            const room = getOrCreateRoom(currentRoomId);
            
            // Add user and websocket to room state
            room.users.set(userId, {
              id: userId,
              name: userName,
              color: userColor
            });
            room.sockets.set(userId, ws);

            console.log(`User ${userName} (${userId}) joined room ${currentRoomId}`);

            // 1. Send the newly joined client the current full Yjs doc state as an update
            const docState = Y.encodeStateAsUpdate(room.yDoc);
            // Convert state to hex or base64 to send over JSON WebSocket safely
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
              const { update } = data.payload; // Base64 or Hex encoded string
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
        
        // If room is completely empty, we can clean it up after a delay
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

  // Helper: Broadcast user list to everyone in a room
  function broadcastUserList(roomId: string) {
    const room = rooms.get(roomId);
    if (room) {
      const usersList = Array.from(room.users.values());
      const payload = JSON.stringify({
        type: "users:list",
        payload: { users: usersList }
      });
      room.sockets.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(payload);
        }
      });
    }
  }

  // Helper: Broadcast to all other room members (excluding sender if specified)
  function broadcastToRoom(roomId: string, excludeUserId: string | null, messageObj: any) {
    const room = rooms.get(roomId);
    if (room) {
      const payload = JSON.stringify(messageObj);
      room.sockets.forEach((socket, userId) => {
        if (userId !== excludeUserId && socket.readyState === WebSocket.OPEN) {
          socket.send(payload);
        }
      });
    }
  }

  // Integrate Vite middleware in development mode
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite dev server middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Port and Host binding
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
