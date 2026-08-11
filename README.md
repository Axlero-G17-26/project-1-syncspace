# SyncSpace

**Domain: Developer Tools and Real-Time Collaboration**

Standard web applications operate on a request/response model. Building a system where multiple users can draw on a canvas or type code simultaneously, without race conditions, lag, or data overwriting, requires complex state synchronization algorithms such as Operational Transformation or Conflict-free Replicated Data Types that standard application tutorials do not cover.

SyncSpace solves this directly. It is a browser-based collaborative workspace built for technical interviews and distributed pair programming sessions. A candidate can draw an architecture diagram on the whiteboard while the interviewer simultaneously writes Node.js code in the editor, both on the same screen, at the same millisecond, without either action breaking the other. The system uses WebSockets to broadcast changes instantly and CRDTs to ensure that if both users edit the same line of code at the exact same moment, the final document state merges perfectly without corruption, without locks, and without a central arbitrator deciding who wins.

The problem this addresses is real. Any team conducting remote technical interviews with standard screen-sharing tools loses the ability to have both participants actively contribute to the same workspace. SyncSpace replaces that passive observation model with an active, shared environment where the interviewer can annotate the candidate's code, draw reference diagrams alongside the candidate's architecture sketch, and replay the entire whiteboard session afterward to review how the candidate's thinking evolved over time.

---

## Table of Contents

- [What it Does](#what-it-does)
- [Architecture at a Glance](#architecture-at-a-glance)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How the Real-time Sync Works](#how-the-real-time-sync-works)
- [How the Whiteboard Works](#how-the-whiteboard-works)
- [Interviewer Dashboard](#interviewer-dashboard)
- [Authentication Flow](#authentication-flow)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Socket Events](#socket-events)
- [Deployment](#deployment)
- [Team](#team)

---

## What it Does

SyncSpace is a browser-based collaborative workspace with four core capabilities.

**Collaborative Code Editing**
Multiple users edit the same file concurrently. Every keystroke is transmitted as a binary CRDT diff and merged on every client within milliseconds. No locking. No overwrite conflicts. Works even when two people type in the same word at the same time.

**Live Whiteboard**
A shared Konva.js canvas where participants can draw freehand lines, rectangles, circles, text, and erase, all synced in real time. Every stroke is assigned to the user who drew it.

**Session Replay**
The entire whiteboard session is recorded as a time-ordered array of stroke events. Any participant can pause, scrub backward and forward through the history, and play back drawings at 1x, 2x, 5x, or 10x speed.

**Interviewer View**
A read-only side panel that shows the code editor and whiteboard simultaneously. Interviewers can observe a candidate's work without interfering with the active session.

---

## Architecture at a Glance

```
Browser (React + Vite)
    |
    |  WebSocket (Socket.io)
    |  REST (Express)
    |
Node.js Server
    |
    |--- Socket.io rooms (one per session)
    |--- Yjs CRDT documents (one Y.Doc per room, held in memory)
    |--- CollaborationPersistence Service
    |       saves Y.Doc binary state to MongoDB every N seconds
    |
MongoDB Atlas
    |--- collaborationDocuments collection
    |--- users collection
```

The server holds a `Y.Doc` instance for every active room. When a client sends a CRDT update the server applies it to the master doc and broadcasts the raw binary to every other socket in that room. When the last user leaves, the final state is persisted to MongoDB. When a new user joins a room that already has a saved state, the server rehydrates the doc from MongoDB and sends the full state vector to the new client.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Component model fits the multi-panel layout |
| Build tool | Vite | Sub-second HMR during development |
| Code editor | Monaco Editor | Same engine as VS Code, handles large files well |
| CRDT library | Yjs + y-monaco | Battle-tested, binary diffs, no central conflict resolution |
| Canvas | Konva.js | React-friendly canvas abstraction |
| WebSocket | Socket.io | Automatic reconnection, room primitives built in |
| Backend | Node.js + Express | Minimal surface area, easy to deploy anywhere |
| Database | MongoDB Atlas + Mongoose | Flexible schema, good binary storage for Yjs state |
| Auth | JWT (jsonwebtoken) | Stateless, socket-level token verification |

---

## Project Structure

```
project-1-syncspace/
|
|-- client/                     # React frontend
|   |-- src/
|   |   |-- components/         # UI components
|   |   |   |-- Auth.tsx        # Login and register forms
|   |   |   |-- CodeEditor.tsx  # Monaco editor with Yjs binding
|   |   |   |-- Whiteboard.tsx  # Konva canvas with multi-user drawing
|   |   |   |-- RoomSelector.tsx
|   |   |   |-- ActivityLogs.tsx
|   |   |   |-- SplashScreen.tsx
|   |   |   |-- InterviewerDashboard.tsx
|   |   |   |-- LoadingScreen.tsx
|   |   |   `-- ErrorBoundary.tsx
|   |   |-- hooks/              # Custom React hooks
|   |   |   |-- useSocket.ts    # Managed Socket.io connection
|   |   |   |-- useAuth.ts      # Auth state with localstore sync
|   |   |   |-- useRoom.ts      # Room state and collaborator list
|   |   |   |-- useEditor.ts    # Monaco config and language state
|   |   |   `-- useWhiteboard.ts# Draw history and tool state
|   |   |-- utils/
|   |   |   |-- constants.ts    # Cursor colors, tool names, socket events
|   |   |   |-- helpers.ts      # roomId generator, debounce, formatTime
|   |   |   `-- localstore.ts   # Token read / write / clear
|   |   |-- App.tsx             # Root component and routing
|   |   `-- main.tsx
|   |-- index.html
|   |-- vite.config.ts
|   `-- package.json
|
|-- server/                     # Express + Socket.io backend
|   |-- src/
|   |   |-- auth/
|   |   |   |-- jwt.js          # Sign and verify tokens
|   |   |   `-- auth.middleware.js
|   |   |-- config/
|   |   |   |-- app.config.js   # Centralised config object
|   |   |   |-- database.js     # Mongoose connect
|   |   |   `-- database.config.js  # Retry logic + health check
|   |   |-- constants/
|   |   |   `-- socketEvents.js
|   |   |-- controllers/
|   |   |   `-- auth.controller.js
|   |   |-- middleware/
|   |   |   |-- rateLimiter.js  # In-memory sliding window
|   |   |   |-- validateRequest.js
|   |   |   `-- cors.js
|   |   |-- models/
|   |   |   `-- collaborationDocument.model.js
|   |   |-- repositories/
|   |   |   `-- collaborationDocument.repository.js
|   |   |-- routes/
|   |   |   `-- auth.routes.js
|   |   |-- services/
|   |   |   |-- collaborationPersistence.service.js
|   |   |   |-- room.service.js
|   |   |   `-- notification.service.js
|   |   |-- sockets/
|   |   |   `-- room.socket.js
|   |   |-- utils/
|   |   |   |-- logger.js       # Structured JSON logger
|   |   |   |-- errorHandler.js # Express error middleware
|   |   |   |-- validation.js
|   |   |   `-- asyncHandler.js
|   |   |-- app.js
|   |   `-- server.js           # HTTP server + Socket.io bootstrap
|   |-- models/
|   |   `-- Users.js
|   `-- package.json
|
|-- docs/
|   |-- architecture.md
|   |-- week1.md               # Week 1 technical notes
|   |-- exp.txt
|   `-- final_deliverables/
|       `-- README.md
|
|-- .github/
|   `-- ISSUE_TEMPLATE/
|       |-- bug_report.md
|       `-- feature_request.md
|
|-- CONTRIBUTING.md
`-- README.md
```

---

## How the Real-time Sync Works

This is the most technically interesting part of SyncSpace. The CRDT pipeline has four stages.

### Stage 1: Local edit produces a binary diff

Every room has a `Y.Doc` instance on both the client and the server. When a user types, Monaco Editor fires a change event. `y-monaco` intercepts this, applies it to the local `Y.Text` object inside the `Y.Doc`, and the doc emits an `update` event containing a compact binary `Uint8Array` describing exactly what changed.

```javascript
yDoc.on("update", (update, origin) => {
  if (origin === "local") {
    const updateHex = Buffer.from(update).toString("hex");
    socket.emit("code:update", updateHex);
  }
});
```

### Stage 2: Server receives and merges

The server receives the hex-encoded update, decodes it back to a buffer, and applies it to its own master `Y.Doc` for that room. Because Yjs is a CRDT, this merge is deterministic regardless of arrival order.

```javascript
socket.on("code:update", (updateHex) => {
  const updateBuffer = Buffer.from(updateHex, "hex");
  Y.applyUpdate(room.yDoc, updateBuffer);
  socket.to(roomId).emit("code:update", updateHex);
});
```

### Stage 3: Broadcast to all peers

The server emits the same hex string to every other socket in the room. Clients receive it and apply it to their local `Y.Doc`:

```javascript
socket.on("code:update", (updateHex) => {
  const updateBuffer = Buffer.from(updateHex, "hex");
  Y.applyUpdate(yDoc, updateBuffer, "remote");
});
```

### Stage 4: New user joins mid-session

When a new socket connects to a room that already has content, the server encodes the full current state of the master doc and sends it as an initialization payload:

```javascript
socket.on("room:join", async ({ roomId }) => {
  const saved = await CollaborationRepo.findByRoomId(roomId);
  if (saved) Y.applyUpdate(room.yDoc, saved.stateBuffer);

  const fullState = Y.encodeStateAsUpdate(room.yDoc);
  socket.emit("sync:init", Buffer.from(fullState).toString("hex"));
});
```

The new client applies this and is immediately in sync with the rest of the room.

### Why no conflicts occur

CRDTs solve the classic operational transform problem without a central arbitrator. Each character insertion in Yjs carries a globally unique identifier derived from the client ID and a logical clock. When two clients insert at the same position concurrently, Yjs merges both operations deterministically using the identifier as a tiebreaker. The result is the same on every client, every time, regardless of network order.

---

## How the Whiteboard Works

The whiteboard is built on `react-konva` and synchronised through the same Socket.io infrastructure.

### Drawing state model

Every stroke is a plain object:

```typescript
interface Stroke {
  tool: "pen" | "line" | "rect" | "circle" | "text" | "eraser";
  points: number[];
  color: string;
  strokeWidth: number;
  userId: string;
  timestamp: number;
}
```

When a user finishes a stroke, the complete `Stroke` object is emitted over the socket. Every client in the room appends it to their local strokes array and re-renders the Konva stage.

### Session Replay

The replay system maintains a separate `replayIndex` pointer into the strokes array. When replay mode is active, the Konva stage renders only `strokes.slice(0, replayIndex)` instead of the full array.

```typescript
const visibleStrokes = isReplayMode ? strokes.slice(0, replayIndex) : strokes;
```

A floating control bar lets users play, pause, and scrub:

```typescript
const intervalMs = Math.max(40, 600 / playbackSpeed);

useEffect(() => {
  if (!isPlaying) return;
  const id = setInterval(() => {
    setReplayIndex(i => {
      if (i >= strokes.length) { setIsPlaying(false); return i; }
      return i + 1;
    });
  }, intervalMs);
  return () => clearInterval(id);
}, [isPlaying, intervalMs, strokes.length]);
```

Drawing is locked while replay mode is active to prevent canvas contamination.

---

## Interviewer Dashboard

The `InterviewerDashboard` component renders a split-panel view: the code editor on the left and the whiteboard on the right. Both panels receive the same socket stream as the candidate's view but do not emit any editing events. The interviewer can observe typing, drawing, and cursor movements in real time without affecting the candidate's session.

The component also exposes a session control bar to start and end the interview, which fires `interviewer:start` and `interviewer:end` events through the `NotificationService`. All participants in the room receive a system notification when the session state changes.

---

## Authentication Flow

SyncSpace uses JWT-based authentication for both REST endpoints and WebSocket connections.

```
Client                      Server
  |                           |
  |-- POST /api/auth/register ->
  |<- { token, username } ----
  |                           |
  |-- io({ auth: { token } }) ->
  |   authMiddleware verifies token
  |   socket.data.user = decoded payload
  |<- connection accepted ----
  |                           |
  |-- room:join { roomId } -->
  |   user identity known from socket.data
  |<- sync:init { stateHex } -
```

Tokens are stored in `localStorage` via the `localstore` utility and loaded on page refresh through the `useAuth` hook. The token is injected into the Socket.io handshake so that every socket event carries verified identity without a separate auth step.

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- MongoDB Atlas account (or a local MongoDB instance)
- Git

### Clone the repository

```bash
git clone https://github.com/Axlero-G17-26/project-1-syncspace.git
cd project-1-syncspace
```

### Install dependencies

```bash
# Frontend
cd client
npm install
cd ..

# Backend
cd server
npm install
cd ..
```

### Configure environment

```bash
# Backend
cp server/.env.example server/.env
# Fill in MONGO_URI and JWT_SECRET

# Frontend
cp client/.env.example client/.env
# Fill in VITE_WS_URL pointing at your backend
```

### Run in development mode

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Open `http://localhost:5173` in two browser tabs. Register two accounts, join the same room ID, and start typing. Both tabs will stay in sync.

---

## Environment Variables

### server/.env

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | Full MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret key for signing tokens. Use a long random string. |
| `PORT` | No | HTTP port. Defaults to 5000. |
| `NODE_ENV` | No | `development` or `production` |
| `ALLOWED_ORIGINS` | No | Comma-separated list of allowed CORS origins |
| `LOG_LEVEL` | No | `error`, `warn`, `info`, or `debug`. Defaults to `info`. |

### client/.env

| Variable | Required | Description |
|---|---|---|
| `VITE_WS_URL` | Yes | URL of the backend server |
| `VITE_API_URL` | No | REST base URL. Defaults to `VITE_WS_URL + /api`. |
| `VITE_APP_NAME` | No | App name shown in the tab title |

---

## API Reference

### Authentication

#### POST /api/auth/register

Register a new user account.

Request body:
```json
{
  "username": "alice",
  "password": "supersecret"
}
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "username": "alice"
}
```

#### POST /api/auth/login

Authenticate and receive a JWT.

Request body:
```json
{
  "username": "alice",
  "password": "supersecret"
}
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGci...",
  "username": "alice"
}
```

### Room State

#### GET /api/rooms/stats

Returns the number of active candidates per room.

Response:
```json
{
  "room-abc123": { "candidates": 2 },
  "room-xyz789": { "candidates": 1 }
}
```

#### GET /api/rooms/check/:roomId

Check whether a room currently exists on the server.

Response:
```json
{ "exists": true }
```

#### GET /api/health

Liveness probe for deployment health checks.

Response:
```json
{ "status": "healthy", "uptime": 3600 }
```

---

## Socket Events

### Client emits

| Event | Payload | Description |
|---|---|---|
| `room:join` | `{ roomId, user }` | Join a room and receive the current doc state |
| `room:leave` | none | Leave the current room |
| `code:update` | `updateHex: string` | Send a Yjs CRDT binary update |
| `whiteboard:draw` | `Stroke` | Broadcast a completed stroke |
| `awareness:cursor` | `{ line, ch, element }` | Broadcast cursor position |
| `interviewer:start` | `{ roomId }` | Start an interview session |
| `interviewer:end` | `{ roomId }` | End an interview session |

### Server emits

| Event | Payload | Description |
|---|---|---|
| `sync:init` | `stateHex: string` | Full Yjs doc state sent on join |
| `code:update` | `updateHex: string` | Forwarded CRDT update from another user |
| `whiteboard:draw` | `Stroke` | Forwarded stroke from another user |
| `room:users` | `User[]` | Updated list of users in the room |
| `awareness:cursor` | `{ userId, cursor }` | Forwarded cursor position |
| `room:notification` | `{ message, type }` | System message broadcast to the room |

---

## Running Tests

The server has unit tests written with Jest covering the repository layer, persistence service, and socket event handling.

```bash
cd server
npm test
```

To run with coverage:

```bash
npm test -- --coverage
```

---

## Deployment

### Railway (recommended for quick deploys)

The server is pre-configured to bind to `0.0.0.0:$PORT` as required by Railway.

1. Create a new Railway project and link this repository.
2. Add a service for the `server` directory.
3. Set the start command to `node src/server.js`.
4. Add the environment variables listed above.
5. Deploy the client separately as a static site on Vercel or Netlify, pointing `VITE_WS_URL` at the Railway service URL.

### Self-hosted with Docker

A `Dockerfile` for the server can be as simple as:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/src ./src
COPY server/models ./models
EXPOSE 5000
CMD ["node", "src/server.js"]
```

Build and run:

```bash
docker build -t syncspace-server .
docker run -p 5000:5000 \
  -e MONGO_URI=... \
  -e JWT_SECRET=... \
  syncspace-server
```

---

## Team

| GitHub | Role |
|---|---|
| [yashkoparde](https://github.com/yashkoparde) | Frontend, WebSocket client, interviewer UI |
| [RaneSoham27](https://github.com/RaneSoham27) | Backend API, infrastructure, deployment |
| [Siddharth7975](https://github.com/Siddharth7975) | Backend services, testing, configuration |

---

> Built as part of Axlero G17 project work. SyncSpace is designed to remove friction from technical interviews and pair programming sessions by putting a shared editor, whiteboard, and replay system in one place.
