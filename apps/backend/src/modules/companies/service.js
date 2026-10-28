'use strict';

const Company = require('./model');
const User = require('../users/model');
const { ConflictError, ValidationError, ApiError } = require('../../utils/errors');

async function assignOwner(companyId, userId, session) {
  if (!session) {
    throw new ApiError(
      503,
      'TRANSACTIONS_REQUIRED',
      'La asignación del propietario requiere una transacción de MongoDB'
    );
  }

  const user = await User.findOne({ _id: userId, companyId })
    .select('_id')
    .session(session)
    .lean();
  if (!user) {
    throw new ValidationError('El propietario debe ser un usuario de la misma empresa');
  }

  const existingOwnership = await Company.findOne({ ownerUserId: user._id })
    .select('_id')
    .session(session)
    .lean();
  if (existingOwnership) {
    throw new ConflictError('El usuario ya es propietario de una empresa');
  }

  try {
    const result = await Company.updateOne(
      {
        _id: companyId,
        $or: [{ ownerUserId: { $exists: false } }, { ownerUserId: null }],
      },
      { $set: { ownerUserId: user._id } },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw new ConflictError('La empresa ya tiene un propietario asignado');
    }
  } catch (err) {
    const duplicateOwner =
      err &&
      err.code === 11000 &&
      ((err.keyPattern && err.keyPattern.ownerUserId) ||
        (err.keyValue && Object.prototype.hasOwnProperty.call(err.keyValue, 'ownerUserId')));
    if (duplicateOwner) {
      throw new ConflictError('El usuario ya es propietario de una empresa');
    }
    throw err;
  }
}

module.exports = { assignOwner };
