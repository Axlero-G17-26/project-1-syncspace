import "dotenv/config";
import mongoose from "mongoose";
import * as Y from "yjs";
import connectDatabase from "../config/database.js";
import collaborationPersistenceService from "../services/collaborationPersistence.service.js";

async function testCollaborationPersistenceService() {
  const testRoomId = "persistence-service-test-room-001";

  try {
    await connectDatabase();

    await collaborationPersistenceService.deleteRoomState(testRoomId);

    const originalYDoc = new Y.Doc();
    const originalYText = originalYDoc.getText("codestate");

    originalYText.insert(
      0,
      "console.log('SyncSpace persistence test');",
    );

    const originalWhiteboardData = [
      {
        x1: 10,
        y1: 20,
        x2: 30,
        y2: 40,
        color: "#333333",
        width: 2,
      },
    ];

    const savedDocument =
      await collaborationPersistenceService.saveRoomState(
        testRoomId,
        originalYDoc,
        originalWhiteboardData,
      );

    console.log("\nRoom saved successfully:");
    console.log({
      roomId: savedDocument.roomId,
      version: savedDocument.version,
      text: originalYText.toString(),
      whiteboardData: savedDocument.whiteboardData,
    });

    const restoredYDoc = new Y.Doc();

    const restoreResult =
      await collaborationPersistenceService.loadRoomState(
        testRoomId,
        restoredYDoc,
      );

    const restoredYText = restoredYDoc.getText("codestate");

    console.log("\nRoom restored successfully:");
    console.log({
      restored: restoreResult.restored,
      version: restoreResult.version,
      text: restoredYText.toString(),
      whiteboardData: restoreResult.whiteboardData,
    });

    const originalText = originalYText.toString();
    const restoredText = restoredYText.toString();

    if (originalText !== restoredText) {
      throw new Error("Restored Yjs text does not match original text.");
    }

    if (restoreResult.whiteboardData.length !== 1) {
      throw new Error("Whiteboard data was not restored correctly.");
    }

    console.log("\nYjs text and whiteboard data matched successfully.");

    await collaborationPersistenceService.deleteRoomState(testRoomId);

    const emptyYDoc = new Y.Doc();

    const missingRoomResult =
      await collaborationPersistenceService.loadRoomState(
        testRoomId,
        emptyYDoc,
      );

    console.log("\nMissing room result:");
    console.log(missingRoomResult);

    if (missingRoomResult.restored !== false) {
      throw new Error("Missing room should return restored: false.");
    }
  } catch (error) {
    console.error("\nPersistence service test failed:");
    console.error(error);

    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("\nMongoDB connection closed.");
  }
}

testCollaborationPersistenceService();