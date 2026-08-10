/**
 * Wraps an async Express route handler to forward errors to next()
 * Eliminates repetitive try/catch blocks in controllers.
 *
 * @param {Function} fn  Async route handler (req, res, next) => Promise
 * @returns {Function}   Wrapped handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
