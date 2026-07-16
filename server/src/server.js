import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import app from "./app.js";
import registerRoomSocket from "./sockets/room.socket.js";
import { SOCKET_EVENTS } from "./constants/socketEvents.js";


dotenv.config();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`socket connected: ${socket.id}`);

  registerRoomSocket(io, socket);
});

server.listen(PORT, () => {
  console.log(`syncspace server is running on port ${PORT}`);
});
