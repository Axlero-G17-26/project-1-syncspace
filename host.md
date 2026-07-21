# SyncSpace Hosting & Architecture Flow

This document outlines the entire end-to-end execution flow of the application when hosted. It explains which files are called, how the frontend and backend communicate, and what happens under the hood when a user opens the application.

---

## 1. Backend Server Initialization
**Entry Point:** `server/src/server.js`
**Execution Command:** `npm start` (or `node src/server.js`)

When the backend starts, the following sequence occurs:
1. **Environment Setup:** `dotenv` loads the configuration (PORT, MongoDB URI, JWT Secrets).
2. **Express Initialization (`server/src/app.js`):** 
   - Express is initialized.
   - Global middlewares are mounted (CORS, JSON parsing).
   - API Routes for authentication (`/api/auth`) and room management (`/api/rooms`) are registered.
3. **Database Connection (`server/src/config/database.js`):**
   - Mongoose connects to the MongoDB instance. If this fails, an error is logged. If successful, persistence is ready.
4. **WebSocket Server Setup (`server/src/server.js`):**
   - The raw HTTP server wraps the Express app.
   - `Socket.io` is attached to handle standard room/presence features (like joining, leaving, chat).
   - A raw `WebSocketServer` (`ws`) is spun up to handle the high-frequency binary data synchronization needed by **Yjs** (CRDT engine).
5. **Listen:** The server begins listening on port `5000` (or dynamically injected `PORT` in production).

---

## 2. Frontend Application Initialization
**Entry Point:** `index.html` → `src/main.tsx` → `src/App.tsx`
**Execution Command:** `npm run dev` (Vite dev server) or served statically via `dist` after `npm run build`.

When a user opens the web application:
1. **Bootstrapping (`src/main.tsx`):**
   - React mounts onto the `#root` div.
   - Global Context Providers (like AuthContext and ThemeContext) are wrapped around the app.
2. **Routing & Authentication (`src/App.tsx`):**
   - The application checks for a stored JWT token in `localStorage`.
   - If missing or invalid, the user is redirected to `src/components/Auth.tsx` (Login/Register).
   - If authenticated, the user is navigated to `src/components/RoomSelector.tsx` where they can create or join a specific workspace room.

---

## 3. Real-Time Collaboration Flow
When an authenticated user successfully joins a room, the dual-pane IDE mounts (`src/components/SplitScreen.tsx`), exposing the Whiteboard (`KonvaWhiteboard.tsx`) and the Code Editor (`CodeEditor.tsx`).

### Step A: The Dual WebSocket Connection
1. **Socket.io Connection:** The client establishes a connection to `ws://localhost:5000` (handled by `server/src/sockets/room.socket.js`).
   - *Purpose:* Emits "user-joined", fetches room metadata, manages standard chat, and handles graceful disconnections.
2. **Yjs WebSocket Connection:** The client opens a raw WebSocket connection via `y-websocket`.
   - *Purpose:* This strictly transmits binary CRDT updates.

### Step B: Syncing the Code Editor (Monaco + Yjs)
1. **Document Setup:** In `src/components/CodeEditor.tsx`, a local `Y.Doc` is created. 
2. **Monaco Binding:** The `MonacoBinding` utility bridges the Monaco Editor model and the `Y.Doc`.
3. **Backend Memory:** On the backend (`server/src/server.js`), when the first user opens the room, the backend creates a server-side `Y.Doc` and attempts to load any previous room state from MongoDB via `server/src/services/collaborationPersistence.service.js`.
4. **Binary Sync:** When the user types, Yjs converts the change into a tiny binary array and sends it over the WebSocket. The backend merges it into the master document and broadcasts it to all other peers in the room.

### Step C: Syncing the Whiteboard (Konva)
1. In `src/components/KonvaWhiteboard.tsx`, drawings (Lines, Rectangles, Text) are serialized as objects.
2. These stroke objects are stored in a Yjs `Y.Array` or `Y.Map`. 
3. When the Yjs document syncs across the network, React components automatically re-render the Konva `<Layer>`, displaying the live drawings to all collaborators.

---

## 4. Multi-User Awareness (Live Cursors)
1. **The Awareness Protocol:** Integrated within Yjs is an "Awareness" layer.
2. **Frontend Emission:** When a user moves their mouse over the Monaco Editor or Konva canvas, `CursorOverlay.tsx` updates their `{ x, y }` coordinates in the awareness state.
3. **Broadcast:** This tiny state is broadcast to all users in the room.
4. **Rendering:** Other clients listen to `awareness.on('change')` and update the absolute DOM positioning of their custom colored mouse pointers (`src/components/CursorOverlay.tsx`), rendering the live names and cursors hovering above the UI.

---

## 5. Session Persistence & Teardown
1. **Periodic Saving:** The backend `server.js` maintains a debounced timer. After 2 seconds of inactivity in a room, it triggers `collaborationPersistence.service.js` to convert the `Y.Doc` into a binary blob and saves it to MongoDB.
2. **Disconnecting:** When a user closes the tab:
   - The Socket.io `disconnect` event fires on the backend.
   - The user is removed from the Awareness tracker (so their cursor disappears for others).
   - If they were the last user in the room, the backend waits for a 30-second `ROOM_CLEANUP_DELAY` before destroying the `Y.Doc` from RAM to preserve memory.
