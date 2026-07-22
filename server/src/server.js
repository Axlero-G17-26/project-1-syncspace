import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { WebSocketServer } from "ws";
import * as Y from "yjs";

import app from "./app.js";
import connectDatabase from "./config/database.js";
import registerRoomSocket from "./sockets/room.socket.js";
import collaborationPersistenceService from "./services/collaborationPersistence.service.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// ======================================================
// Socket.IO Setup
// Used for existing chat/presence room functionality
// ======================================================

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`Socket.IO client connected: ${socket.id}`);

  registerRoomSocket(io, socket);
});

// ======================================================
// Collaborative Workspace Storage
// Used by raw WebSocket + Yjs
// ======================================================

// Stores active rooms currently loaded in RAM
const rooms = new Map();

// Stores room loading promises to prevent multiple simultaneous
// MongoDB loads for the same room
const roomLoadPromises = new Map();

// Save room only after user stops changing data for 2 seconds
const ROOM_SAVE_DELAY_MS = 2000;

// ======================================================
// Get Existing Room or Create/Restore Room
// ======================================================

async function getOrCreateRoom(roomId) {
  // Room is already active in memory
  if (rooms.has(roomId)) {
    return rooms.get(roomId);
  }

  // Room is currently being loaded by another connection
  if (roomLoadPromises.has(roomId)) {
    return roomLoadPromises.get(roomId);
  }

  const roomLoadPromise = (async () => {
    const yDoc = new Y.Doc();

    // Try to restore room state from MongoDB
    const restoreResult =
      await collaborationPersistenceService.loadRoomState(roomId, yDoc);

    const yText = yDoc.getText("codestate");

    // Add default code only when this is a completely new room
    if (!restoreResult.restored && yText.toString() === "") {
      yText.insert(
        0,
        `// Welcome to the Real-time Collaborative Workspace!
// Room ID: ${roomId}

function helloSyncSpace() {
  console.log("Start collaborating!");
}
`,
      );
    }

    const room = {
      yDoc,

      // Restore saved whiteboard strokes or use empty array
      strokes: restoreResult.whiteboardData || [],

      // Active user information
      users: new Map(),

      // Active WebSocket connections
      sockets: new Map(),

      // Latest MongoDB persistence version
      persistenceVersion: restoreResult.version,

      // Indicates whether room has unsaved changes
      isDirty: false,

      // Debounce timer
      saveTimeout: null,
    };

    rooms.set(roomId, room);

    if (restoreResult.restored) {
      console.log(
        `Room ${roomId} restored from MongoDB at version ${restoreResult.version}`,
      );
    } else {
      console.log(`New room ${roomId} created`);
    }

    return room;
  })();

  roomLoadPromises.set(roomId, roomLoadPromise);

  try {
    return await roomLoadPromise;
  } finally {
    roomLoadPromises.delete(roomId);
  }
}

// ======================================================
// Persist Room State to MongoDB
// ======================================================

async function persistRoom(roomId, room) {
  // No room or no unsaved changes
  if (!room || !room.isDirty) {
    return;
  }

  try {
    const savedDocument =
      await collaborationPersistenceService.saveRoomState(
        roomId,
        room.yDoc,
        room.strokes,
      );

    room.persistenceVersion = savedDocument.version;
    room.isDirty = false;

    console.log(
      `Room ${roomId} persisted successfully at version ${savedDocument.version}`,
    );
  } catch (error) {
    console.error(`Failed to persist room ${roomId}:`, error);

    // Keep dirty state true so it can be saved again
    room.isDirty = true;
  }
}

// ======================================================
// Schedule Debounced Room Persistence
// ======================================================

function scheduleRoomPersistence(roomId, room) {
  if (!room) {
    return;
  }

  room.isDirty = true;

  // Cancel previous timer because another change arrived
  if (room.saveTimeout) {
    clearTimeout(room.saveTimeout);
  }

  room.saveTimeout = setTimeout(async () => {
    room.saveTimeout = null;

    await persistRoom(roomId, room);
  }, ROOM_SAVE_DELAY_MS);
}

// ======================================================
// Raw WebSocket Setup
// Used for Yjs code editor and whiteboard collaboration
// ======================================================

const wss = new WebSocketServer({
  noServer: true,
});

// Handle WebSocket upgrade request
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(
    request.url,
    `http://${request.headers.host}`,
  ).pathname;

  // Socket.IO handles its own /socket.io upgrade requests
  if (pathname.startsWith("/socket.io")) {
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

// ======================================================
// Raw WebSocket Connection
// ======================================================

wss.on("connection", (ws) => {
  let currentRoomId = "default";
  let currentUserId = "";

  console.log("Raw WebSocket client connected");

  // ====================================================
  // Handle WebSocket Messages
  // ====================================================

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        // ================================================
        // Join Room
        // ================================================

        case "join": {
          const {
            roomId,
            userName,
            userColor,
            userId,
          } = data.payload;

          currentRoomId = roomId || "default";
          currentUserId = userId;

          const room = await getOrCreateRoom(currentRoomId);

          room.users.set(userId, {
            id: userId,
            name: userName,
            color: userColor,
          });

          room.sockets.set(userId, ws);

          console.log(
            `User ${userName} (${userId}) joined room ${currentRoomId} via WebSocket`,
          );

          // Send current Yjs document state
          const docState = Y.encodeStateAsUpdate(room.yDoc);
          const docUpdateHex = Buffer.from(docState).toString("hex");

          ws.send(
            JSON.stringify({
              type: "init:code",
              payload: {
                update: docUpdateHex,
              },
            }),
          );

          // Send saved whiteboard strokes
          ws.send(
            JSON.stringify({
              type: "init:whiteboard",
              payload: {
                strokes: room.strokes,
              },
            }),
          );

          // Send updated user list
          broadcastUserList(currentRoomId);

          break;
        }

        // ================================================
        // Whiteboard Stroke
        // ================================================

        case "whiteboard:stroke": {
          const room = rooms.get(currentRoomId);

          if (!room) {
            break;
          }

          const stroke = data.payload.stroke;

          room.strokes.push(stroke);

          // Schedule MongoDB persistence
          scheduleRoomPersistence(currentRoomId, room);

          // Broadcast stroke to all other users
          broadcastToRoom(currentRoomId, currentUserId, {
            type: "whiteboard:stroke",
            payload: {
              stroke,
            },
          });

          break;
        }

        // ================================================
        // Clear Whiteboard
        // ================================================

        case "whiteboard:clear": {
          const room = rooms.get(currentRoomId);

          if (!room) {
            break;
          }

          room.strokes = [];

          // Schedule MongoDB persistence
          scheduleRoomPersistence(currentRoomId, room);

          // Broadcast clear event to everyone
          broadcastToRoom(currentRoomId, null, {
            type: "whiteboard:clear",
          });

          break;
        }

        // ================================================
        // Yjs Code Update
        // ================================================

        case "code:update": {
          const room = rooms.get(currentRoomId);

          if (!room) {
            break;
          }

          const { update } = data.payload;

          // Convert hexadecimal update into Buffer
          const updateBuffer = Buffer.from(update, "hex");

          // Apply update to server-side Yjs document
          Y.applyUpdate(room.yDoc, updateBuffer);

          // Schedule MongoDB persistence
          scheduleRoomPersistence(currentRoomId, room);

          // Send update to other users
          broadcastToRoom(currentRoomId, currentUserId, {
            type: "code:update",
            payload: {
              update,
            },
          });

          break;
        }

        // ================================================
        // Cursor Movement
        // Cursor is temporary and is not persisted
        // ================================================

        case "cursor:move": {
          const room = rooms.get(currentRoomId);

          if (!room) {
            break;
          }

          const user = room.users.get(currentUserId);

          if (!user) {
            break;
          }

          user.cursor = data.payload.cursor;

          broadcastToRoom(currentRoomId, currentUserId, {
            type: "cursor:move",
            payload: {
              userId: currentUserId,
              cursor: data.payload.cursor,
            },
          });

          break;
        }

        // ================================================
        // Collaborative Activity Message
        // ================================================

        case "message:send": {
          const room = rooms.get(currentRoomId);

          if (!room) {
            break;
          }

          const {
            message: logMessage,
            userName,
            userColor,
          } = data.payload;

          broadcastToRoom(currentRoomId, null, {
            type: "message:recv",
            payload: {
              id: Math.random().toString(36).substring(7),
              timestamp: new Date().toLocaleTimeString(),
              userName,
              userColor,
              text: logMessage,
            },
          });

          break;
        }

        default: {
          console.warn(`Unknown WebSocket message type: ${data.type}`);
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });

  // ====================================================
  // WebSocket Disconnect
  // ====================================================

  ws.on("close", async () => {
    console.log(
      `WebSocket closed for User ${currentUserId} in Room ${currentRoomId}`,
    );

    const room = rooms.get(currentRoomId);

    if (!room) {
      return;
    }

    room.users.delete(currentUserId);
    room.sockets.delete(currentUserId);

    // No users remaining in room
    if (room.users.size === 0) {
      try {
        // Cancel pending debounced save
        if (room.saveTimeout) {
          clearTimeout(room.saveTimeout);
          room.saveTimeout = null;
        }

        // Save all remaining changes before removing room
        await persistRoom(currentRoomId, room);

        // Destroy Yjs document to release memory
        room.yDoc.destroy();

        // Remove room only from RAM
        // MongoDB document remains stored
        rooms.delete(currentRoomId);

        console.log(
          `Removed inactive room ${currentRoomId} from memory`,
        );
      } catch (error) {
        console.error(
          `Failed while closing room ${currentRoomId}:`,
          error,
        );
      }
    } else {
      // Inform remaining users
      broadcastUserList(currentRoomId);
    }
  });

  // ====================================================
  // WebSocket Error
  // ====================================================

  ws.on("error", (error) => {
    console.error(
      `WebSocket error for User ${currentUserId}:`,
      error,
    );
  });
});

// ======================================================
// Broadcast Active User List
// ======================================================

function broadcastUserList(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  const usersList = Array.from(room.users.values());

  const payload = JSON.stringify({
    type: "users:list",
    payload: {
      users: usersList,
    },
  });

  room.sockets.forEach((socket) => {
    // WebSocket readyState 1 means OPEN
    if (socket.readyState === 1) {
      socket.send(payload);
    }
  });
}

// ======================================================
// Broadcast Message to Room
// ======================================================

function broadcastToRoom(roomId, excludeUserId, messageObject) {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  const payload = JSON.stringify(messageObject);

  room.sockets.forEach((socket, userId) => {
    const shouldExcludeUser =
      excludeUserId !== null && userId === excludeUserId;

    if (!shouldExcludeUser && socket.readyState === 1) {
      socket.send(payload);
    }
  });
}

// ======================================================
// Start Server
// ======================================================

async function startServer() {
  try {
    await connectDatabase();

    server.listen(PORT, () => {
      console.log(`SyncSpace server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error(
      "SyncSpace server startup failed:",
      error.message,
    );

    process.exit(1);
  }
}

startServer();