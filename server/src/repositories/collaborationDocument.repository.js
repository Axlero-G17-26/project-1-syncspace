import CollaborationDocument from "../models/collaborationDocument.model.js";

class CollaborationDocumentRepository {
  async findByRoomId(roomId) {
    return CollaborationDocument.findOne({ roomId });
  }

  async saveRoomState({
    roomId,
    yjsState,
    whiteboardData = [],
  }) {
    return CollaborationDocument.findOneAndUpdate(
      {
        roomId,
      },
      {
        $set: {
          yjsState,
          whiteboardData,
          lastPersistedAt: new Date(),
        },
        $inc: {
          version: 1,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
  }

  async deleteByRoomId(roomId) {
    return CollaborationDocument.deleteOne({ roomId });
  }

  async roomExists(roomId) {
    return CollaborationDocument.exists({ roomId });
  }
}

const collaborationDocumentRepository =
  new CollaborationDocumentRepository();

export default collaborationDocumentRepository;