import * as Y from "yjs";
import collaborationDocumentRepository from "../repositories/collaborationDocument.repository.js";

class CollaborationPersistenceService {
  async loadRoomState(roomId, yDoc) {
    const savedDocument =
      await collaborationDocumentRepository.findByRoomId(roomId);

    if (!savedDocument) {
      return {
        restored: false,
        whiteboardData: [],
        version: 0,
      };
    }

    if (savedDocument.yjsState) {
      const savedState = new Uint8Array(savedDocument.yjsState);

      Y.applyUpdate(yDoc, savedState);
    }

    return {
      restored: true,
      whiteboardData: savedDocument.whiteboardData || [],
      version: savedDocument.version,
    };
  }

  async saveRoomState(roomId, yDoc, whiteboardData = []) {
    const encodedState = Y.encodeStateAsUpdate(yDoc);

    const yjsStateBuffer = Buffer.from(encodedState);

    return collaborationDocumentRepository.saveRoomState({
      roomId,
      yjsState: yjsStateBuffer,
      whiteboardData,
    });
  }

  async deleteRoomState(roomId) {
    return collaborationDocumentRepository.deleteByRoomId(roomId);
  }
}

const collaborationPersistenceService =
  new CollaborationPersistenceService();

export default collaborationPersistenceService;