import mongoose from "mongoose";

const collaborationDocumentSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    yjsState: {
      type: Buffer,
      default: null,
    },

    whiteboardData: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },

    version: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastPersistedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const CollaborationDocument = mongoose.model(
  "CollaborationDocument",
  collaborationDocumentSchema
);

export default CollaborationDocument;