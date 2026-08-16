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

export const error = (msg, meta) => log('error', msg, meta);
export const warn  = (msg, meta) => log('warn',  msg, meta);
export const info  = (msg, meta) => log('info',  msg, meta);
export const debug = (msg, meta) => log('debug', msg, meta);

const logger = { error, warn, info, debug };
export default logger;
