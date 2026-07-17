# Week 1: Real-time Multi-User Architecture with Socket.io & Yjs

This guide explains how to design, build, and configure a production-ready, full-stack collaborative real-time sync system using Express, Socket.io, and Yjs CRDTs. It walks through how to establish isolated multi-user rooms, handle real-time state synchronization, and broadcast cursor positions (awareness) across all participants.

---

## 1. Setting Up Socket.io with Express

Using Socket.io provides automatic reconnections, fallbacks, and built-in namespace/room management on top of a standard Express HTTP server.

### Backend Setup (server.js or server.ts)

To integrate Socket.io into an Express application, instantiate an HTTP server using Node's native http module, mount the Express application, and bind the Socket.io server to the HTTP instance.

```typescript
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with CORS settings
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Basic Express routing
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Socket.io Connection Handler
io.on("connection", (socket) => {
  console.log(`Client connected: \${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: \${socket.id}`);
  });
});

const PORT = 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port \${PORT}`);
});
```

### Client Setup (App.tsx or main.tsx)

Install the client-side socket package: npm install socket.io-client. Then initialize the socket instance in your React application:

```typescript
import { io } from "socket.io-client";

// Initialize client socket connection
const socket = io(window.location.origin, {
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

---

## 2. Implementing Isolated Rooms for Multi-team Collaboration

To prevent data leakage between teams, you must group sockets into distinct rooms. Socket.io provides a built-in join and leave API that manages this transparently.

### Joining and Segmenting Rooms on the Backend

When a client joins a workspace, they should transmit a join event containing their roomId and personal credentials. The backend moves their socket into the requested room using socket.join(roomId).

```typescript
interface UserProfile {
  id: string;
  name: string;
  color: string;
}

// Keep track of room participants in-memory
const activeRooms = new Map<string, Map<string, UserProfile>>();

io.on("connection", (socket) => {
  let currentRoomId: string | null = null;
  let currentUserId: string | null = null;

  socket.on("room:join", ({ roomId, user }: { roomId: string; user: UserProfile }) => {
    // Leave previous room if any
    if (currentRoomId) {
      socket.leave(currentRoomId);
      removeUserFromRoom(currentRoomId, socket.id);
    }

    currentRoomId = roomId;
    currentUserId = socket.id;

    // Join the isolated Socket.io room
    socket.join(roomId);

    // Track user state in our custom room manager
    if (!activeRooms.has(roomId)) {
      activeRooms.set(roomId, new Map());
    }
    activeRooms.get(roomId)!.set(socket.id, user);

    console.log(`User \${user.name} joined room: \${roomId}`);

    // Broadcast updated user list to everyone in this room ONLY
    const usersInRoom = Array.from(activeRooms.get(roomId)!.values());
    io.to(roomId).emit("room:users", usersInRoom);
  });

  socket.on("disconnect", () => {
    if (currentRoomId && currentUserId) {
      removeUserFromRoom(currentRoomId, currentUserId);
      
      // Update remaining users in the room
      const room = activeRooms.get(currentRoomId);
      if (room) {
        const usersInRoom = Array.from(room.values());
        io.to(currentRoomId).emit("room:users", usersInRoom);
      }
    }
  });
});

function removeUserFromRoom(roomId: string, socketId: string) {
  const room = activeRooms.get(roomId);
  if (room) {
    room.delete(socketId);
    if (room.size === 0) {
      activeRooms.delete(roomId);
    }
  }
}
```

---

## 3. Configuring the Backend as a Yjs Awareness & Sync Server

To build conflict-free real-time editors, the backend must keep a central representation of the document, apply incoming state vector changes (Yjs updates), and synchronize them. It also must act as an awareness server to handle temporary collaborative states, such as live cursor positions and active selection ranges.

### The CRDT Sync Mechanism

1. **Client Edits**: The client changes text. The local Yjs document (Y.Doc) produces a binary diff (Uint8Array).
2. **Network Transmission**: The client converts the update to a safe hexadecimal or base64 string and sends it to the server.
3. **Server Merge**: The server receives the update, decodes it, and applies it to its own in-memory Y.Doc using Y.applyUpdate. This automatically merges any competing or concurrent typing without conflicts.
4. **Broadcasting**: The server broadcasts this update to all other connected sockets in the room.

### Code Implementation: Central Sync & Awareness

Below is the complete implementation for room-isolated sync and cursor broadcasting:

```typescript
import * as Y from "yjs";

interface CursorData {
  line: number;
  ch: number;
  element: "editor" | "whiteboard";
}

// Extend our room definition to include Yjs documents
interface RoomState {
  yDoc: Y.Doc;
  users: Map<string, UserProfile & { cursor?: CursorData }>;
}

const serverRooms = new Map<string, RoomState>();

function getOrCreateYjsRoom(roomId: string): RoomState {
  if (!serverRooms.has(roomId)) {
    const yDoc = new Y.Doc();
    
    // Seed initial document text
    const yText = yDoc.getText("codestate");
    yText.insert(0, "// Start writing code here with your team...\\n");

    serverRooms.set(roomId, {
      yDoc,
      users: new Map()
    });
  }
  return serverRooms.get(roomId)!;
}

io.on("connection", (socket) => {
  let joinedRoomId: string | null = null;

  socket.on("join", ({ roomId, user }: { roomId: string; user: UserProfile }) => {
    joinedRoomId = roomId;
    socket.join(roomId);

    const room = getOrCreateYjsRoom(roomId);
    room.users.set(socket.id, { ...user });

    // 1. Send the newly connected client the full state of the Yjs document
    const fullStateUpdate = Y.encodeStateAsUpdate(room.yDoc);
    socket.emit("sync:init", Buffer.from(fullStateUpdate).toString("hex"));

    // 2. Broadcast the list of active users to the room
    io.to(roomId).emit("users:update", Array.from(room.users.values()));
  });

  // Handle incoming CRDT text updates
  socket.on("code:update", (updateHex: string) => {
    if (!joinedRoomId) return;
    
    const room = serverRooms.get(joinedRoomId);
    if (room) {
      try {
        const updateBuffer = Buffer.from(updateHex, "hex");
        
        // Apply changes to the master Yjs document on the server
        Y.applyUpdate(room.yDoc, updateBuffer);

        // Broadcast the update to all other users in this room
        socket.to(joinedRoomId).emit("code:update", updateHex);
      } catch (err) {
        console.error("Failed to apply CRDT merge update:", err);
      }
    }
  });

  // Handle real-time cursor/awareness positions
  socket.on("cursor:move", (cursor: CursorData) => {
    if (!joinedRoomId) return;

    const room = serverRooms.get(joinedRoomId);
    if (room) {
      const user = room.users.get(socket.id);
      if (user) {
        // Update user cursor position on the server
        user.cursor = cursor;

        // Broadcast the cursor move to all other participants
        socket.to(joinedRoomId).emit("cursor:move", {
          userId: socket.id,
          cursor
        });
      }
    }
  });

  socket.on("disconnect", () => {
    if (joinedRoomId) {
      const room = serverRooms.get(joinedRoomId);
      if (room) {
        room.users.delete(socket.id);
        
        // Clean up empty room state to free memory
        if (room.users.size === 0) {
          serverRooms.delete(joinedRoomId);
        } else {
          io.to(joinedRoomId).emit("users:update", Array.from(room.users.values()));
        }
      }
    }
  });
});
```

---

## 4. Key Architectural Trade-offs & Best Practices

1. **State Persistence**: Memory limits dictate how long room states reside in the server's cache. In a production environment, periodically save the serialized Yjs document (Y.encodeStateAsUpdate(doc)) to a durable cloud database like Google Cloud Firestore or PostgreSQL as a binary blob.
2. **Debouncing Awareness Updates**: Cursor movements (cursor:move) trigger very frequently. On the client, wrap your mouse movement listeners in a throttle or debounce function (e.g., 50ms interval limit) to minimize network congestion.
3. **State Vector Syncing**: On first join, rather than sending the entire document state, you can exchange state vectors (Y.encodeStateVector(doc)) to negotiate and transmit only the missing delta updates. This maximizes performance on extremely large codebases.
