class RoomService {
  constructor() {
    this.rooms = new Map();
  }

  joinRoom(roomId, user) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    const roomUsers = this.rooms.get(roomId);

    roomUsers.set(user.socketId, user);

    return this.getRoomUsers(roomId);
  }

  leaveRoom(roomId, socketId) {
    const roomUsers = this.rooms.get(roomId);

    if (!roomUsers) {
      return [];
    }

    roomUsers.delete(socketId);

    if (roomUsers.size === 0) {
      this.rooms.delete(roomId);
      return [];
    }

    return this.getRoomUsers(roomId);
  }

  getRoomUsers(roomId) {
    const roomUsers = this.rooms.get(roomId);

    if (!roomUsers) {
      return [];
    }

    return Array.from(roomUsers.values());
  }

  getUser(roomId, socketId) {
    const roomUsers = this.rooms.get(roomId);

    if (!roomUsers) {
      return null;
    }

    return roomUsers.get(socketId) || null;
  }

  roomExists(roomId) {
    return this.rooms.has(roomId);
  }
}

const roomService = new RoomService();

export default roomService;
