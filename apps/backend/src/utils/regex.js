'use strict';

/** Escapa metacaracteres de regex para búsquedas de usuario seguras. */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
