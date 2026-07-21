import mongoose from "mongoose";

/**
 * Establishes the application's MongoDB connection.
 *
 * The server should call this function before accepting
 * HTTP or WebSocket connections.
 *
 * @returns {Promise<typeof mongoose>}
 * @throws {Error} When MONGODB_URI is missing or MongoDB cannot be reached.
 */
async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is missing. Add it to the server environment variables."
    );
  }

  try {
    const mongooseInstance = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
    });

    console.log(
      `MongoDB connected successfully: ${mongooseInstance.connection.host}`
    );

    return mongooseInstance;
  } catch (error) {
    console.error("MongoDB initial connection failed:", error.message);
    throw error;
  }
}

export default connectDatabase;