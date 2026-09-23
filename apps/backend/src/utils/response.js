'use strict';

/** Formato único de respuesta de éxito: { success:true, data }. */
function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function sendCreated(res, data) {
  return sendSuccess(res, data, 201);
}

module.exports = { sendSuccess, sendCreated };
