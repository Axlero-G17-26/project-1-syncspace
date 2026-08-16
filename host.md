# Hosting & Deployment Guide (SyncSpace)

This guide covers how to build and host the application. The repository is completely decoupled into a standalone React `client` and an Express/Socket.io `server`. 

## Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun

## Local Development / Production Build

To host the application locally for testing, you need to build the client-side React application, and run the Node.js server independently.

### 1. Build the Frontend
Navigate into the `client` folder, install the dependencies, and create a production build.
```bash
cd client
npm install
npm run build
```
This will compile the React code into static files located in `client/dist/`. To preview it locally, run `npm start` (which runs `vite preview`).

### 2. Configure the Backend Environment
Open a terminal in the project root and navigate to the `server` directory to set up your environment variables.
```bash
cd server
npm install
cp .env.example .env
```
Open `server/.env` and ensure the following variables are set:
- `PORT=5000` (or your preferred port)
- `MONGODB_URI=<your-mongodb-connection-string>`
- `JWT_SECRET=<your-secure-jwt-secret>`
- `CLIENT_URL=http://localhost:5173` (or whatever port the client is running on)
- `ALLOWED_ORIGINS=http://localhost:5173`

*Note: For local UI testing without a database, the server will detect if MongoDB is not connected and automatically fallback to an in-memory session.*

### 3. Start the Server
Start the backend server:
```bash
npm start
```
The server will boot up and serve your API and WebSockets on `http://localhost:5000`.

## Deploying to Production (Render)

This project uses a decoupled architecture. You must deploy the Backend and Frontend as two separate services. 

### Backend (Web Service)
1. Go to your hosting provider (e.g. Render) and create a **Web Service**.
2. Set the Root Directory to `server`.
3. Set the Build Command to `npm install`.
4. Set the Start Command to `node src/server.js`.
5. Add your Environment Variables (`MONGODB_URI`, `JWT_SECRET`, etc).
6. Copy the deployed URL (e.g., `https://syncspace-server.onrender.com`).

### Frontend (Static Site)
1. Create a **Static Site**.
2. Set the Root Directory to `client`.
3. Set the Build Command to `npm run build`.
4. Set the Publish Directory to `dist`.
5. Add your Environment Variables:
   - `VITE_WS_URL`: `https://syncspace-server.onrender.com`
   - `VITE_API_URL`: `https://syncspace-server.onrender.com/api`
6. Deploy the frontend, and take its URL (e.g., `https://syncspace-client.onrender.com`).

### Final CORS Setup
Go back to the Backend service and add the frontend URL to the `CLIENT_URL` and `ALLOWED_ORIGINS` environment variables, then trigger a manual deploy to apply the CORS rules.
