# SyncSpace v2 — Architecture Overview

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Real-time Editor | Monaco Editor + Yjs CRDT |
| Whiteboard | Konva.js (canvas) |
| WebSocket | Socket.io |
| Backend | Node.js + Express |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT (jsonwebtoken) |

## Frontend Component Tree

```
App.tsx
├── SplashScreen         — Brand loading screen
├── Auth                 — Login / Register
├── RoomSelector         — Create or join a room
│
├── [In-Room Layout]
│   ├── CodeEditor       — Monaco + Yjs real-time sync
│   ├── Whiteboard       — Konva multi-user canvas
│   ├── ActivityLogs     — Session event timeline
│   └── CursorOverlay    — Collaborator cursors
│
└── InterviewerDashboard — Side-by-side interviewer view
```

## Backend Architecture

```
server.js  (Express + Socket.io bootstrapper)
│
├── /api/auth            — JWT login & register
├── authMiddleware       — Token verification
├── rateLimiter          — Request throttling
│
├── CollaborationPersistence
│   └── Stores Yjs binary updates → MongoDB
│
├── NotificationService
│   └── Broadcasts system messages to rooms
│
└── RoomSocket
    └── join / leave / awareness / draw events
```

## Data Flow

1. User logs in → receives JWT
2. JWT used to authenticate WebSocket connection
3. User joins a room → Yjs document loaded from MongoDB
4. All edits broadcast via Socket.io → persisted asynchronously
5. Interviewer view receives read-only stream of changes
