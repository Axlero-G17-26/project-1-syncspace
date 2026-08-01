import "dotenv/config";
import mongoose from "mongoose";
import connectDatabase from "../config/database.js";
import collaborationDocumentRepository from "../repositories/collaborationDocument.repository.js";

async function testCollaborationDocumentRepository() {
  const testRoomId = "repository-test-room-001";

  try {
    await connectDatabase();

    await collaborationDocumentRepository.deleteByRoomId(testRoomId);

    const firstYjsState = Buffer.from([10, 20, 30, 40]);

    const firstSavedDocument =
      await collaborationDocumentRepository.saveRoomState({
        roomId: testRoomId,
        yjsState: firstYjsState,
        whiteboardData: [
          {
            x1: 5,
            y1: 10,
            x2: 25,
            y2: 30,
            color: "#111111",
            width: 2,
          },
        ],
      });

    console.log("\nFirst save successful:");
    console.log({
      roomId: firstSavedDocument.roomId,
      version: firstSavedDocument.version,
      yjsState: firstSavedDocument.yjsState,
      whiteboardData: firstSavedDocument.whiteboardData,
      lastPersistedAt: firstSavedDocument.lastPersistedAt,
    });

    const roomExists =
      await collaborationDocumentRepository.roomExists(testRoomId);

    console.log("\nRoom exists result:");
    console.log(roomExists);

    const fetchedDocument =
      await collaborationDocumentRepository.findByRoomId(testRoomId);

    console.log("\nRoom fetched successfully:");
    console.log({
      roomId: fetchedDocument.roomId,
      version: fetchedDocument.version,
      yjsState: fetchedDocument.yjsState,
      whiteboardData: fetchedDocument.whiteboardData,
    });

    const secondYjsState = Buffer.from([50, 60, 70, 80]);

    const secondSavedDocument =
      await collaborationDocumentRepository.saveRoomState({
        roomId: testRoomId,
        yjsState: secondYjsState,
        whiteboardData: [
          ...fetchedDocument.whiteboardData,
          {
            x1: 35,
            y1: 40,
            x2: 55,
            y2: 60,
            color: "#222222",
            width: 3,
          },
        ],
      });

    console.log("\nSecond save successful:");
    console.log({
      roomId: secondSavedDocument.roomId,
      version: secondSavedDocument.version,
      yjsState: secondSavedDocument.yjsState,
      whiteboardData: secondSavedDocument.whiteboardData,
      lastPersistedAt: secondSavedDocument.lastPersistedAt,
    });

    const deleteResult =
      await collaborationDocumentRepository.deleteByRoomId(testRoomId);

    console.log("\nRoom deleted successfully:");
    console.log(deleteResult);

    const deletedRoom =
      await collaborationDocumentRepository.findByRoomId(testRoomId);

    console.log("\nRoom after deletion:");
    console.log(deletedRoom);
  } catch (error) {
    console.error("\nRepository test failed:");
    console.error(error);

    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("\nMongoDB connection closed.");
  }
}

testCollaborationDocumentRepository();