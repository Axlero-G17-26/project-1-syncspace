/**
 * MongoDB connection configuration
 * Wraps database.js with retry logic and health check.
 */
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const MONGO_URI = process.env.MONGO_URI || '';
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function connectWithRetry(attempt = 1) {
  try {
    await mongoose.connect(MONGO_URI, {
      retryWrites: true,
      w: 'majority',
      serverSelectionTimeoutMS: 5000,
    });
    logger.info('MongoDB connected', { attempt });
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    logger.warn(`MongoDB connect failed, retrying (${attempt}/${MAX_RETRIES})...`);
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    return connectWithRetry(attempt + 1);
  }
}

function isConnected() {
  return mongoose.connection.readyState === 1;
}

module.exports = { connectWithRetry, isConnected };
