import { SOCKET_EVENTS } from "../constants/socketEvents.js";
import roomService from "../services/room.service.js";

const registerRoomSocket = (io, socket) => {
  socket.on(SOCKET_EVENTS.JOIN_ROOM, ({ roomId, username }) => {
    if (!roomId || !username) {
      socket.emit(SOCKET_EVENTS.SOCKET_ERROR, {
        message: "Room ID and username are required",
      });

      return;
    }

    socket.join(roomId);

    socket.data.roomId = roomId;
    socket.data.username = username;

    const user = {
      socketId: socket.id,
      username,
      roomId,
    };

    const roomUsers = roomService.joinRoom(roomId, user);

    socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
      roomId,
      user,
    });

    socket.to(roomId).emit(SOCKET_EVENTS.USER_JOINED, {
      user,
    });

    io.to(roomId).emit(SOCKET_EVENTS.ROOM_USERS, {
      roomId,
      users: roomUsers,
    });

    console.log(`${username} joined room ${roomId}`);
  });

  socket.on(SOCKET_EVENTS.SEND_MESSAGE, ({ message }) => {
    const roomId = socket.data.roomId;
    const username = socket.data.username;

    if (!roomId || !message?.trim()) {
      return;
    }

    io.to(roomId).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, {
      socketId: socket.id,
      username,
      message: message.trim(),
      timestamp: new Date().toISOString(),
    });
  });

  socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
    handleLeaveRoom(io, socket);
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    handleLeaveRoom(io, socket);

    console.log(`Socket disconnected: ${socket.id}`);
  });
};

const handleLeaveRoom = (io, socket) => {
  const roomId = socket.data.roomId;
  const username = socket.data.username;

  if (!roomId) {
    return;
  }

  const remainingUsers = roomService.leaveRoom(roomId, socket.id);

  socket.leave(roomId);

  socket.to(roomId).emit(SOCKET_EVENTS.USER_LEFT, {
    socketId: socket.id,
    username,
  });

  io.to(roomId).emit(SOCKET_EVENTS.ROOM_USERS, {
    roomId,
    users: remainingUsers,
  });

  console.log(`${username} left room ${roomId}`);

  socket.data.roomId = null;
  socket.data.username = null;
};

export default registerRoomSocket;
