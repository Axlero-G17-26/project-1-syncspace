/**
 * In-room notification service
 * Broadcasts system messages to all users in a room.
 */
class NotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Send a system notification to all sockets in a room.
   * @param {string} roomId
   * @param {string} message
   * @param {'info'|'warning'|'error'} type
   */
  notify(roomId, message, type = 'info') {
    this.io.to(roomId).emit('room:notification', {
      message,
      type,
      timestamp: Date.now(),
    });
  }

  userJoined(roomId, username) {
    this.notify(roomId, `${username} joined the session`, 'info');
  }

  userLeft(roomId, username) {
    this.notify(roomId, `${username} left the session`, 'info');
  }

  sessionStarted(roomId) {
    this.notify(roomId, 'Interview session started', 'info');
  }

  sessionEnded(roomId) {
    this.notify(roomId, 'Interview session ended', 'warning');
  }
}

module.exports = NotificationService;
