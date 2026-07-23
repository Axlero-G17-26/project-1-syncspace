/**
 * Input validation helpers
 */
function isValidUsername(username) {
  return typeof username === 'string' && /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

function isValidRoomId(roomId) {
  return typeof roomId === 'string' && /^[a-zA-Z0-9-]{4,50}$/.test(roomId);
}

function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [field, validator] of Object.entries(schema)) {
      if (!validator(req.body[field])) {
        errors.push({ field, message: `Invalid value for ${field}` });
      }
    }
    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }
    next();
  };
}

module.exports = { isValidUsername, isValidPassword, isValidRoomId, validateBody };
