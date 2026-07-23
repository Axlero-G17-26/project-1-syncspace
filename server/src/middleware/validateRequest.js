/**
 * Request schema validation middleware factory
 */
const { validateBody } = require('../utils/validation');

function validateLogin() {
  return validateBody({
    username: v => typeof v === 'string' && v.trim().length >= 3,
    password: v => typeof v === 'string' && v.length >= 6,
  });
}

function validateRegister() {
  return validateBody({
    username: v => typeof v === 'string' && /^[a-zA-Z0-9_]{3,30}$/.test(v),
    password: v => typeof v === 'string' && v.length >= 6,
  });
}

function validateJoinRoom() {
  return validateBody({
    roomId: v => typeof v === 'string' && v.trim().length >= 4,
  });
}

module.exports = { validateLogin, validateRegister, validateJoinRoom };
