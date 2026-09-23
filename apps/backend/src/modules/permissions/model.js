'use strict';

const { Schema, model } = require('mongoose');

/**
 * permissions — catálogo GLOBAL de permisos (no es multiempresa):
 * la llave `module.action` es la misma para todas las empresas;
 * lo que varía por empresa es QUÉ permisos tiene cada rol (roles.permissions).
 */
const permissionSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 60 },
    module: { type: String, required: true, maxlength: 40 },
    action: { type: String, required: true, maxlength: 30 },
    description: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

permissionSchema.index({ module: 1 });

module.exports = model('Permission', permissionSchema);
