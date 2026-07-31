# Contributing to SyncSpace

Thank you for contributing to SyncSpace!

## Project Structure

```
syncspace/
├── client/          # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── utils/        # Utility functions
│   │   └── App.tsx       # Root component
├── server/          # Node.js backend (Express + Socket.io)
│   ├── src/
│   │   ├── auth/         # JWT authentication
│   │   ├── config/       # App configuration
│   │   ├── constants/    # Shared constants
│   │   ├── controllers/  # REST API controllers
│   │   ├── middleware/   # Express middleware
│   │   ├── models/       # Mongoose schemas
│   │   ├── repositories/ # Data access layer
│   │   ├── routes/       # Express route definitions
│   │   ├── services/     # Business logic
│   │   ├── sockets/      # Socket.io event handlers
│   │   ├── tests/        # Unit tests
│   │   └── utils/        # Server utilities
└── docs/            # Project documentation
```

## Development Setup

```bash
# Clone the repo
git clone https://github.com/Axlero-G17-26/project-1-syncspace.git
cd project-1-syncspace

# Install frontend dependencies
cd client && npm install && cd ..

# Install backend dependencies
cd server && npm install && cd ..

# Configure environment
cp client/.env.example client/.env
cp server/.env.example server/.env   # fill in MONGO_URI and JWT_SECRET

# Start development servers
cd client && npm run dev   # http://localhost:5173
cd server && npm run dev   # http://localhost:3000
```

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Description |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `refactor:` | Code restructuring |
| `test:` | Adding/updating tests |
| `chore:` | Maintenance tasks |

## Team

- **yashkoparde** — Frontend & WebSocket client
- **RaneSoham27** — Backend & API
- **Siddharth7975** — Backend & Infrastructure
