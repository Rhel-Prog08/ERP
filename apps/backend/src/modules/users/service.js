'use strict';

/**
 * Servicio del módulo users — gestión de usuarios POR EMPRESA.
 * Garantías:
 *  - Todo filtro lleva companyId del actor (aislamiento multiempresa).
 *  - Las contraseñas NUNCA se auditan ni se devuelven (hash en pre('save')).
 *  - Un usuario no se deactiva a sí mismo ni se cambia su propio rol/estado.
 */
const User = require('./model');
const Role = require('../roles/model');
const Company = require('../companies/model');
const { withTransaction } = require('../../config/db');
const { NotFoundError, ValidationError, ConflictError } = require('../../utils/errors');
const { getPagination, getSort, paginated } = require('../../utils/pagination');
const { escapeRegex } = require('../../utils/regex');
const { assertPasswordStrength } = require('../../utils/password');
const { assertPermission } = require('../../utils/assertPermission');
const { recordAudit, auditFromReq, requestMeta } = require('../audit/service');

/** Campos ordenables del listado. */
const SORT_FIELDS = ['firstName', 'lastName', 'email', 'createdAt', 'status'];
/** Whitelist de campos editables por un administrador (sin passwords). */
const EDITABLE_FIELDS = ['firstName', 'lastName', 'email', 'roleId', 'status'];

/** GET /users — listado paginado + búsqueda, siempre de la empresa del actor. */
async function list(actor, query = {}) {
  const { page, limit, skip } = getPagination(query);
  const sort = getSort(query, SORT_FIELDS, '-createdAt');

  const filter = { companyId: actor.companyId };
  if (query.status) filter.status = query.status;
  if (query.roleId) filter.roleId = query.roleId;
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate({ path: 'roleId', select: 'name' })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return paginated(items, { page, limit }, total);
}

/** GET /users/:id — detalle scoping por empresa. Sin campos sensibles. */
async function get(actor, id) {
  const doc = await User.findOne({ _id: id, companyId: actor.companyId })
    .populate({ path: 'roleId', select: 'name' })
    .lean();
  if (!doc) throw new NotFoundError('Usuario no encontrado');
  return doc;
}

/**
 * POST /users — alta de usuario.
 * `body.companyId` distinto del actor = alta cross-company: exige además
 * companies.create y que la empresa destino exista; si no, se usa la del actor.
 */
async function create(actor, body, req) {
  const crossCompany = Boolean(body.companyId) && body.companyId !== actor.companyId;
  const destCompanyId = crossCompany ? body.companyId : actor.companyId;

  if (crossCompany) {
    assertPermission(req, 'companies.create');
    const companyExists = await Company.exists({ _id: body.companyId });
    if (!companyExists) throw new NotFoundError('Empresa no encontrada');
  }

  assertPasswordStrength(body.password);

  // El rol debe existir en la empresa DESTINO.
  const role = await Role.findOne({ _id: body.roleId, companyId: destCompanyId }).lean();
  if (!role) throw new ValidationError('El rol no existe en la empresa destino');

  // Email único global (el índice único también devolvería 409).
  const duplicated = await User.exists({ email: body.email });
  if (duplicated) throw new ConflictError('Ese email ya está registrado');

  const [doc] = await User.create([
    {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      password: body.password, // hash automático en pre('save')
      roleId: body.roleId,
      companyId: destCompanyId,
      status: body.status || 'active',
    },
  ]);

  await auditFromReq(req, {
    action: 'CREATE_USER',
    module: 'users',
    entity: 'user',
    entityId: doc._id,
    newValue: {
      id: String(doc._id),
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      roleId: String(doc.roleId),
      companyId: String(doc.companyId),
      status: doc.status,
      // NUNCA la contraseña.
    },
    description: `Usuario ${doc.email} creado`,
  });

  return doc;
}

/**
 * PATCH /users/:id — edición con guards:
 *  - nadie se cambia su propio estado ni su propio rol;
 *  - email único; rol válido en la empresa del TARGET;
 *  - newPassword → fuerza + cierra sesiones del target (refreshTokens=[]).
 */
async function update(actor, id, patch, req) {
  return withTransaction(async (session) => {
    let findQuery = User.findOne({ _id: id, companyId: actor.companyId }).select(
      '+password +refreshTokens'
    );
    if (session) findQuery = findQuery.session(session);
    const target = await findQuery;
    if (!target) throw new NotFoundError('Usuario no encontrado');

    const isSelf = String(target._id) === actor.id;
    if (isSelf && (patch.status !== undefined || patch.roleId !== undefined)) {
      throw new ConflictError('No puedes cambiar tu propio estado ni tu propio rol');
    }

    if (patch.email !== undefined && patch.email !== target.email) {
      const duplicated = await User.exists({ email: patch.email, _id: { $ne: target._id } });
      if (duplicated) throw new ConflictError('Ese email ya está registrado');
    }

    if (patch.roleId !== undefined) {
      const role = await Role.findOne({ _id: patch.roleId, companyId: target.companyId }).lean();
      if (!role) throw new ValidationError('El rol no existe en la empresa del usuario');
    }

    const passwordChanged = patch.newPassword !== undefined;
    if (passwordChanged) assertPasswordStrength(patch.newPassword, 'newPassword');

    // Snapshot SÓLO de los campos realmente modificados (sin passwords).
    const previousValue = {};
    const newValue = {};
    for (const field of EDITABLE_FIELDS) {
      const value = patch[field];
      if (value === undefined) continue;
      if (target[field] != null && String(target[field]) === String(value)) continue;
      previousValue[field] = target[field] !== undefined && target[field] !== null ? target[field] : null;
      target[field] = value;
      newValue[field] = value;
    }

    if (passwordChanged) {
      target.password = patch.newPassword; // hash en pre('save')
      target.refreshTokens = [];           // cierra las sesiones del target
    }

    if (Object.keys(newValue).length > 0 || passwordChanged) {
      await target.save(session ? { session } : {});

      await recordAudit(
        {
          userId: actor.id,
          companyId: actor.companyId,
          action: 'UPDATE_USER',
          module: 'users',
          entity: 'user',
          entityId: target._id,
          previousValue,
          newValue,
          description: `Usuario ${target.email} actualizado`,
          ...requestMeta(req),
        },
        { session, strict: Boolean(session) }
      );

      if (passwordChanged) {
        await recordAudit(
          {
            userId: actor.id,
            companyId: actor.companyId,
            action: 'CHANGE_PASSWORD',
            module: 'users',
            entity: 'user',
            entityId: target._id,
            description: 'Contraseña reiniciada por administrador',
            ...requestMeta(req),
          },
          { session, strict: Boolean(session) }
        );
      }
    }

    return target;
  });
}

/**
 * DELETE /users/:id — baja LÓGICA (nunca borro físico):
 * status='inactive' + revocación de refresh tokens. Idempotente.
 */
async function deactivate(actor, id, req) {
  const target = await User.findOne({ _id: id, companyId: actor.companyId }).select(
    '+refreshTokens'
  );
  if (!target) throw new NotFoundError('Usuario no encontrado');
  if (String(target._id) === actor.id) throw new ConflictError('No puedes desactivarte a ti mismo');
  if (target.status !== 'active') return target; // ya inactivo → idempotente

  target.status = 'inactive';
  target.refreshTokens = [];
  await target.save();

  await recordAudit({
    userId: actor.id,
    companyId: actor.companyId,
    action: 'DEACTIVATE_USER',
    module: 'users',
    entity: 'user',
    entityId: target._id,
    previousValue: { status: 'active' },
    newValue: { status: 'inactive' },
    description: `Usuario ${target.email} desactivado`,
    ...requestMeta(req),
  });

  return target;
}

module.exports = { list, get, create, update, deactivate };
