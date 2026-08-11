# CRDT Notes — SyncSpace

## What problem CRDT solves?

CRDT (Conflict-free Replicated Data Type) solves the problem of **real-time collaboration and conflict resolution** between multiple users.

In SyncSpace, multiple users can work on the same whiteboard or code editor at the same time. One user can move the cursor, draw something, write code, or send a message while another user is doing the same thing.

CRDT makes sure that these changes can be **merged and synchronized automatically** so that every connected user eventually sees the same updated state.

Basically, CRDT handles different users' **changes, code edits, drawings, and other collaborative operations** and keeps them synchronized for everyone in the meeting.

---

## Why Socket.io alone isn't enough?

Socket.io is mainly responsible for **transporting real-time messages/data** between the client and server.

It can send an update from:

```text
User A → Server → User B
```

But Socket.io itself does not solve what happens when multiple users make changes **at the same time**.

For example:

```text
User A → writes "Hello"
User B → writes "World"
        ↓
Both changes happen simultaneously
```

Socket.io can transport both messages, but it does not decide how these changes should be merged without causing conflicts.

This is where **CRDT/Yjs** comes in.

```text
Socket.io → Transports the updates
CRDT/Yjs  → Handles synchronization and conflicts
```

So, Socket.io and CRDT have different responsibilities.

---

## What does Y.Doc represent?

`Y.Doc` can be understood like a **shared notebook**.

Imagine two friends, Friend A and Friend B, using the same notebook.

### Example

Friend A opens the notebook and writes:

```text
Essay 1:
Artificial Intelligence is changing the world...
```

Later, Friend B opens the same notebook and writes:

```text
Essay 2:
Cloud computing allows applications to scale...
```

The shared notebook keeps track of both changes.

Similarly, in SyncSpace:

```text
             Y.Doc
               |
      -------------------
      |        |        |
   User A    User B   User C
      |        |        |
    Edit     Edit     Edit
      \        |       /
       \       |      /
        ---- Shared State ----
```

`Y.Doc` represents the **shared collaborative document state**.

Yjs uses this document to track changes made by different users and synchronize those changes between connected clients.

Even if multiple users make changes at nearly the same time, Yjs/CRDT can merge those changes into a consistent state.

---

## Authentication in SyncSpace

Authentication is responsible for verifying **who the user is** before allowing them to access collaborative resources.

CRDT handles **synchronization**, while authentication handles **identity and access control**.

For example:

```text
User
 ↓
Login / Register
 ↓
JWT Authentication
 ↓
Authenticated User
 ↓
Join Room
 ↓
Access Collaborative Y.Doc
```

SyncSpace can use **JWT (JSON Web Token)** for authentication.

After successful login, the server generates a JWT containing the user's identity.

The client then sends the token when making authenticated requests or establishing a collaborative connection.

The backend verifies the token before allowing the user to access protected resources.

### Authentication vs Authorization

**Authentication** answers:

> "Who are you?"

**Authorization** answers:

> "Are you allowed to access this room/document?"

For example:

```text
JWT
 ↓
Verify User Identity
 ↓
Check Room Access
 ↓
Allow Connection
 ↓
Access Y.Doc
```

This prevents unauthorized users from simply connecting to a room and accessing its collaborative data.

---

## CRDT + Socket.io + Authentication

All three components have different responsibilities:

```text
┌──────────────────────────────┐
│       SyncSpace Client       │
└──────────────┬───────────────┘
               │
               │ JWT
               ↓
┌──────────────────────────────┐
│       Authentication         │
│      Verify User Identity    │
└──────────────┬───────────────┘
               │
               │ Authorized
               ↓
┌──────────────────────────────┐
│          Socket.io            │
│    Real-time Data Transport  │
└──────────────┬───────────────┘
               │
               │ Updates
               ↓
┌──────────────────────────────┐
│          Yjs / CRDT           │
│ Sync + Conflict Resolution   │
└──────────────┬───────────────┘
               │
               ↓
        Shared Y.Doc State
```

### In simple words:

* **Authentication** → Identifies the user.
* **Authorization** → Checks whether the user can access the room/document.
* **Socket.io** → Transports real-time updates.
* **Yjs / CRDT** → Synchronizes changes and resolves conflicts.
* **Y.Doc** → Represents the shared collaborative document state.

This separation of responsibilities makes the SyncSpace collaboration system more secure, reliable, and scalable.
