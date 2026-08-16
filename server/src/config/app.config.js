/**
 * Centralised application configuration
 */
export default {
  app: {
    name: 'SyncSpace',
    version: '2.0.0',
    env: process.env.NODE_ENV || 'development',
  },
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '7d',
  },
  mongo: {
    uri: process.env.MONGO_URI,
    options: { retryWrites: true, w: 'majority' },
  },
  room: {
    maxCollaborators: 10,
    cleanupGracePeriodMs: 30 * 60 * 1000, // 30 min
  },
};
