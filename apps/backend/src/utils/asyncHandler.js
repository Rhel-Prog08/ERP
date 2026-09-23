'use strict';

/** Envuelve controladores async para propagar errores al errorHandler global. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
