/**
 * Simple structured logger utility
 */
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = process.env.LOG_LEVEL || 'info';

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] > LOG_LEVELS[currentLevel]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

module.exports = {
  error: (msg, meta) => log('error', msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  debug: (msg, meta) => log('debug', msg, meta),
};
