import "dotenv/config";
import mongoose from "mongoose";
import connectDatabase from "../config/database.js";
import CollaborationDocument from "../models/collaborationDocument.model.js";

async function testCollaborationDocumentModel() {
  try {
    await connectDatabase();

    const testRoomId = "test-room-001";

    await CollaborationDocument.deleteOne({
      roomId: testRoomId,
    });

    const sampleYjsState = Buffer.from([1, 2, 3, 4, 5]);

    const createdDocument = await CollaborationDocument.create({
      roomId: testRoomId,
      yjsState: sampleYjsState,
      whiteboardData: [
        {
          x1: 10,
          y1: 20,
          x2: 50,
          y2: 60,
          color: "#000000",
          width: 2,
        },
      ],
      version: 1,
      lastPersistedAt: new Date(),
    });

    console.log("Document created successfully:");
    console.log(createdDocument);

    const savedDocument = await CollaborationDocument.findOne({
      roomId: testRoomId,
    });

    console.log("\nDocument fetched successfully:");
    console.log(savedDocument);

    await CollaborationDocument.deleteOne({
      roomId: testRoomId,
    });

    console.log("\nTest document deleted successfully.");
  } catch (error) {
    console.error("Model test failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

testCollaborationDocumentModel();