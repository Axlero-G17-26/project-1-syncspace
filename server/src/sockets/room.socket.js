import { SOCKET_EVENTS } from "../constants/socketEvents.js";
import roomService from "../services/room.service.js";

const registerRoomSocket = (io, socket) => {
  // ======================================================
  // JOIN ROOM
  // ======================================================

  socket.on(
    SOCKET_EVENTS.JOIN_ROOM,
    async ({ roomId, username, roomName }) => {
      try {
        // --------------------------------------------------
        // Validate basic room information
        // --------------------------------------------------

        if (!roomId || !username) {
          socket.emit(SOCKET_EVENTS.SOCKET_ERROR, {
            message:
              "Room ID and username are required",
          });

          return;
        }

        // --------------------------------------------------
        // Socket authentication check
        // --------------------------------------------------

        if (!socket.user) {
          socket.emit(SOCKET_EVENTS.SOCKET_ERROR, {
            message:
              "Authenticated user information is missing",
          });

          return;
        }

        const userId = socket.user._id.toString();

        // --------------------------------------------------
        // Room name
        // --------------------------------------------------
        // For existing clients that don't send roomName,
        // use roomId as the initial room name.
        // This keeps the existing client compatible.
        // --------------------------------------------------

        const finalRoomName =
          roomName?.trim() || roomId;

        // --------------------------------------------------
        // Create/load persistent room metadata
        // --------------------------------------------------

        const existingRoom =
          await roomService.getRoomMetadata(
            roomId,
          );

        let room;

        if (!existingRoom) {
          // First authenticated user becomes owner.
          room =
            await roomService.createOrGetRoom(
              roomId,
              finalRoomName,
              socket.user._id,
            );

          console.log(
            `Room ${roomId} created by ${socket.user.email}`,
          );
        } else {
          room = existingRoom;

          // ------------------------------------------------
          // Existing room:
          // Add authenticated user as member.
          // ------------------------------------------------

          await roomService.addMember(
            roomId,
            socket.user._id,
          );

          console.log(
            `User ${socket.user.email} joined existing room ${roomId}`,
          );
        }

        // --------------------------------------------------
        // Join Socket.IO room
        // --------------------------------------------------

        socket.join(roomId);

        socket.data.roomId = roomId;
        socket.data.username = username;
        socket.data.userId = userId;

        // --------------------------------------------------
        // Runtime user information
        // --------------------------------------------------

        const user = {
          socketId: socket.id,
          userId,
          username,
          roomId,
        };

        const roomUsers =
          await roomService.joinRoom(
            roomId,
            user,
          );

        // --------------------------------------------------
        // Notify joining user
        // --------------------------------------------------

        socket.emit(
          SOCKET_EVENTS.ROOM_JOINED,
          {
            roomId,
            user,
          },
        );

        // --------------------------------------------------
        // Notify existing users
        // --------------------------------------------------

        socket
          .to(roomId)
          .emit(
            SOCKET_EVENTS.USER_JOINED,
            {
              user,
            },
          );

        // --------------------------------------------------
        // Send updated active user list
        // --------------------------------------------------

        io.to(roomId).emit(
          SOCKET_EVENTS.ROOM_USERS,
          {
            roomId,
            users: roomUsers,
          },
        );

        console.log(
          `${username} joined room ${roomId} as user ${userId}`,
        );
      } catch (error) {
        console.error(
          `Failed to join room ${roomId}:`,
          error,
        );

        socket.emit(
          SOCKET_EVENTS.SOCKET_ERROR,
          {
            message: "Failed to join room",
          },
        );
      }
    },
  );

  // ======================================================
  // SEND MESSAGE
  // ======================================================

  socket.on(
    SOCKET_EVENTS.SEND_MESSAGE,
    ({ message }) => {
      const roomId = socket.data.roomId;
      const username = socket.data.username;

      if (!roomId || !message?.trim()) {
        return;
      }

      io.to(roomId).emit(
        SOCKET_EVENTS.RECEIVE_MESSAGE,
        {
          socketId: socket.id,
          username,
          message: message.trim(),
          timestamp:
            new Date().toISOString(),
        },
      );
    },
  );

  // ======================================================
  // LEAVE ROOM
  // ======================================================

  socket.on(
    SOCKET_EVENTS.LEAVE_ROOM,
    async () => {
      await handleLeaveRoom(io, socket);
    },
  );

  // ======================================================
  // DISCONNECT
  // ======================================================

  socket.on(
    SOCKET_EVENTS.DISCONNECT,
    async () => {
      await handleLeaveRoom(io, socket);

      console.log(
        `Socket disconnected: ${socket.id}`,
      );
    },
  );
};

// ======================================================
// HANDLE LEAVE ROOM
// ======================================================

const handleLeaveRoom = async (io, socket) => {
  const roomId = socket.data.roomId;
  const username = socket.data.username;

  if (!roomId) {
    return;
  }

  try {
    const remainingUsers =
      await roomService.leaveRoom(
        roomId,
        socket.id,
      );

    socket.leave(roomId);

    socket
      .to(roomId)
      .emit(
        SOCKET_EVENTS.USER_LEFT,
        {
          socketId: socket.id,
          username,
        },
      );

    io.to(roomId).emit(
      SOCKET_EVENTS.ROOM_USERS,
      {
        roomId,
        users: remainingUsers,
      },
    );

    console.log(
      `${username} left room ${roomId}`,
    );
  } catch (error) {
    console.error(
      `Failed to leave room ${roomId}:`,
      error,
    );
  } finally {
    socket.data.roomId = null;
    socket.data.username = null;
    socket.data.userId = null;
  }
};

export default registerRoomSocket;