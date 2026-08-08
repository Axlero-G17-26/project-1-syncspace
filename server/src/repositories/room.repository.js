import Room from "../models/room.model.js";

class RoomRepository {
  // Find a room using its room ID
  async findByRoomId(roomId) {
    return Room.findOne({ roomId });
  }

  // Create a new room
  async createRoom({ roomId, name, ownerId }) {
    return Room.create({
      roomId,
      name,
      owner: ownerId,
      members: [ownerId],
    });
  }

  // Find an existing room or create a new one
  async findOrCreateRoom({ roomId, name, ownerId }) {
    let room = await this.findByRoomId(roomId);

    if (room) {
      return room;
    }

    return this.createRoom({
      roomId,
      name,
      ownerId,
    });
  }

  // Add a member to the room
  async addMember(roomId, userId) {
    return Room.findOneAndUpdate(
      { roomId },
      {
        $addToSet: {
          members: userId,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );
  }

  // Remove a member from the room
  async removeMember(roomId, userId) {
    return Room.findOneAndUpdate(
      { roomId },
      {
        $pull: {
          members: userId,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );
  }

  // Check whether a user is a member of the room
  async isMember(roomId, userId) {
    return Room.exists({
      roomId,
      members: userId,
    });
  }

  // Check whether a user owns the room
  async isOwner(roomId, userId) {
    return Room.exists({
      roomId,
      owner: userId,
    });
  }

  // Update room metadata
  async updateRoom(roomId, updates) {
    return Room.findOneAndUpdate(
      { roomId },
      {
        $set: updates,
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );
  }

  // Delete a room
  async deleteRoom(roomId) {
    return Room.deleteOne({ roomId });
  }

  // Check whether a room exists
  async roomExists(roomId) {
    return Room.exists({ roomId });
  }
}

const roomRepository = new RoomRepository();

export default roomRepository;
