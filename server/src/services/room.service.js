import roomRepository from "../repositories/room.repository.js";

class RoomService {
  constructor() {
    // Active users for currently running rooms.
    // This is runtime state and intentionally stays in memory.
    this.rooms = new Map();
  }

  // ======================================================
  // Create or load room metadata
  // ======================================================

  async createOrGetRoom(roomId, name, ownerId) {
    const room = await roomRepository.findOrCreateRoom({
      roomId,
      name,
      ownerId,
    });

    return room;
  }

  // ======================================================
  // Join room
  // ======================================================

  async joinRoom(roomId, user) {
   

    // Create runtime room if it does not exist.
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }

    const roomUsers = this.rooms.get(roomId);

    roomUsers.set(user.socketId, user);

    return this.getRoomUsers(roomId);
  }

  // ======================================================
  // Leave room
  // ======================================================

  async leaveRoom(roomId, socketId) {
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

  // ======================================================
  // Get active users
  // ======================================================

  getRoomUsers(roomId) {
    const roomUsers = this.rooms.get(roomId);

    if (!roomUsers) {
      return [];
    }

    return Array.from(roomUsers.values());
  }

  // ======================================================
  // Get active user
  // ======================================================

  getUser(roomId, socketId) {
    const roomUsers = this.rooms.get(roomId);

    if (!roomUsers) {
      return null;
    }

    return roomUsers.get(socketId) || null;
  }

  // ======================================================
  // Check active room
  // ======================================================

  roomExists(roomId) {
    return this.rooms.has(roomId);
  }

  // ======================================================
  // Check persistent room
  // ======================================================

  async persistentRoomExists(roomId) {
    return Boolean(
      await roomRepository.roomExists(roomId),
    );
  }

  // ======================================================
  // Add member
  // ======================================================

  async addMember(roomId, userId) {
    return roomRepository.addMember(
      roomId,
      userId,
    );
  }

  // ======================================================
  // Remove member
  // ======================================================

  async removeMember(roomId, userId) {
    return roomRepository.removeMember(
      roomId,
      userId,
    );
  }

  // ======================================================
  // Check room membership
  // ======================================================

  async isMember(roomId, userId) {
    return Boolean(
      await roomRepository.isMember(
        roomId,
        userId,
      ),
    );
  }

  // ======================================================
  // Check room ownership
  // ======================================================

  async isOwner(roomId, userId) {
    return Boolean(
      await roomRepository.isOwner(
        roomId,
        userId,
      ),
    );
  }

  // ======================================================
  // Get room metadata
  // ======================================================

  async getRoomMetadata(roomId) {
    return roomRepository.findByRoomId(
      roomId,
    );
  }

  // ======================================================
  // Update room metadata
  // ======================================================

  async updateRoom(roomId, updates) {
    return roomRepository.updateRoom(
      roomId,
      updates,
    );
  }

  // ======================================================
  // Delete room
  // ======================================================

  async deleteRoom(roomId) {
    // Remove runtime room first.
    this.rooms.delete(roomId);

    // Remove persistent room metadata.
    return roomRepository.deleteRoom(
      roomId,
    );
  }
}

const roomService = new RoomService();

export default roomService;