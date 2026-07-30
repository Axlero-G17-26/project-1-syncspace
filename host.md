# Hosting & Deployment Guide (SyncSpace)

This guide covers how to build and host the application, as the repository has been refactored into a `client` and `server` structure. The backend Express server is configured to serve both the API and the React frontend on the same port.

## Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun

## Local Development / Production Build

To host the application, you need to build the client-side React application first, and then start the Node.js server. 

### 1. Build the Frontend
Navigate into the `client` folder, install the dependencies, and create a production build.
```bash
cd client
npm install
npm run build
```
This will compile the React code into static files located in `client/dist/`.

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
- `ADMIN_KEY=ADMIN123` (Set to a secure string for Interviewer authentication)

*Note: For local UI testing without a database, the server will detect if MongoDB is not connected and automatically fallback to an in-memory session to prevent crashes.*

### 3. Start the Server
Start the backend server:
```bash
npm start
```
The server will boot up and serve your API routes. Additionally, it is configured to serve the static frontend files from `client/dist`. 

You can now visit the application by navigating to http://localhost:5000 (or whichever port you specified).

## Deploying to Production

This project uses a unified architecture where the Node.js backend serves the compiled React frontend. This means you can deploy the entire application as a **single backend service** on platforms like Render, Railway, or Heroku without needing a separate frontend host like Vercel.

### Option 1: Render / Railway / Heroku (Recommended)

1. Create a new Web Service and link your GitHub repository.
2. Set the **Build Command** to:
   ```bash
   cd client && npm install && npm run build && cd ../server && npm install
   ```
3. Set the **Start Command** to:
   ```bash
   cd server && npm start
   ```
4. Set your Environment Variables:
   - `MONGODB_URI`: Your secure MongoDB connection string.
   - `ADMIN_KEY`: A secure key used for Interviewer authentication.

### Option 2: Split Deployment (Vercel + Render)

If you prefer to host the frontend on Vercel and the backend on Render, you can do so by splitting the deployment:

**Frontend (Vercel):**
1. Set the Framework Preset to `Vite`.
2. Set the Root Directory to `client`.
3. Add an Environment Variable `VITE_API_URL` pointing to your backend's public URL.
4. Add an Environment Variable `VITE_WS_URL` pointing to your backend's public WebSocket URL (e.g., `wss://your-backend.onrender.com`).

**Backend (Render):**
1. Set the Root Directory to `server`.
2. Set the Build Command to `npm install`.
3. Set the Start Command to `npm start`.
4. Ensure `MONGODB_URI` and `ADMIN_KEY` are configured.

*(Note: If splitting the deployment, ensure your backend's CORS policies allow requests from the Vercel domain).*
