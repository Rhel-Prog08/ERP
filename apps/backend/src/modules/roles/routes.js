'use strict';

/**
 * Rutas del módulo roles — CRUD ESPECIAL por empresa (no es la fábrica):
 *  - Aislamiento total por companyId (todo filtro lleva la empresa del token).
 *  - Las claves de `permissions` se validan contra el catálogo global.
 *  - Guard de seguridad: los permisos del rol PROPIO no se pueden tocar.
 *  - Los roles de sistema (isSystem) no se eliminan; tampoco los en uso.
 */
const router = require('express').Router();
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../../utils/response');
const { validate } = require('../../utils/validate');
const { NotFoundError, ValidationError, ConflictError } = require('../../utils/errors');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { withTransaction } = require('../../config/db');
const { recordAudit, auditFromReq, requestMeta } = require('../audit/service');
const Role = require('./model');
const Permission = require('../permissions/model');
const User = require('../users/model');
const { roleCreateSchema, roleUpdateSchema } = require('./validation');

/** Campos editables y auditables de un rol. */
const EDITABLE_FIELDS = ['name', 'permissions', 'status'];

/**
 * Comprueba que TODAS las claves existan en el catálogo `permissions`.
 * Fórmula: countDocuments({key:{$in}}) === new Set(keys).size.
 * Si alguna es desconocida → ValidationError con el detalle de claves.
 */
async function assertPermissionKeys(keys) {
  const unique = [...new Set(keys || [])];
  if (unique.length === 0) return;
  const found = await Permission.countDocuments({ key: { $in: unique } });
  if (found === unique.length) return;
  // Sólo al fallar: listar cuáles son las claves desconocidas.
  const known = await Permission.find({ key: { $in: unique } }).select('key').lean();
  const knownSet = new Set(known.map((p) => p.key));
  const unknown = unique.filter((k) => !knownSet.has(k));
  throw new ValidationError('Permisos no válidos', [
    { field: 'permissions', message: `Claves desconocidas: ${unknown.join(', ')}` },
  ]);
}

// GET /api/v1/roles — roles de la empresa del token.
router.get(
  '/',
  authenticate,
  authorize('roles.read'),
  asyncHandler(async (req, res) => {
    const data = await Role.find({ companyId: req.user.companyId }).sort({ name: 1 }).lean();
    sendSuccess(res, data);
  })
);

// GET /api/v1/roles/:id — detalle scoping por empresa (otra empresa → 404).
router.get(
  '/:id',
  authenticate,
  authorize('roles.read'),
  asyncHandler(async (req, res) => {
    const rol = await Role.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!rol) throw new NotFoundError('Rol no encontrado');
    sendSuccess(res, rol);
  })
);

// POST /api/v1/roles — alta con permisos validados y auditoría transaccional.
router.post(
  '/',
  authenticate,
  authorize('roles.create'),
  validate(roleCreateSchema),
  asyncHandler(async (req, res) => {
    const { name, permissions = [], status } = req.body;
    await assertPermissionKeys(permissions);

    const doc = await withTransaction(async (session) => {
      const [created] = await Role.create(
        [
          {
            name,
            companyId: req.user.companyId,
            permissions,
            isSystem: false,
            status: status || 'active',
          },
        ],
        session ? { session } : {}
      );

      await auditFromReq(
        req,
        {
          action: 'CREATE_ROLE',
          module: 'roles',
          entity: 'role',
          entityId: created._id,
          newValue: { name: created.name, permissions: created.permissions },
          description: 'Rol creado',
        },
        { session, strict: Boolean(session) }
      );

      return created;
    });

    sendCreated(res, doc);
  })
);

// PATCH /api/v1/roles/:id — edición con guard del rol propio y snapshot.
router.patch(
  '/:id',
  authenticate,
  authorize('roles.update'),
  validate(roleUpdateSchema),
  asyncHandler(async (req, res) => {
    const patch = req.body;
    const permissionsChanged = patch.permissions !== undefined;

    const doc = await withTransaction(async (session) => {
      let findQuery = Role.findOne({ _id: req.params.id, companyId: req.user.companyId });
      if (session) findQuery = findQuery.session(session);
      const rol = await findQuery;
      if (!rol) throw new NotFoundError('Rol no encontrado');

      // Guard: nadie debe poder alterar los permisos del rol que está usando.
      if (permissionsChanged && String(rol._id) === req.user.role.id) {
        throw new ConflictError('No puedes modificar los permisos de tu propio rol');
      }
      if (permissionsChanged) await assertPermissionKeys(patch.permissions);

      // Snapshot SÓLO de los campos modificados.
      const previousValue = {};
      const newValue = {};
      for (const field of EDITABLE_FIELDS) {
        const value = patch[field];
        if (value === undefined) continue;
        previousValue[field] = field === 'permissions' ? [...rol[field]] : rol[field];
        rol[field] = value;
        newValue[field] = field === 'permissions' ? [...value] : value;
      }

      if (Object.keys(newValue).length > 0) {
        await rol.save(session ? { session } : {});
        await recordAudit(
          {
            userId: req.user.id,
            companyId: req.user.companyId,
            action: permissionsChanged ? 'ROLE_CHANGE' : 'UPDATE_ROLE',
            module: 'roles',
            entity: 'role',
            entityId: rol._id,
            previousValue,
            newValue,
            description: permissionsChanged
              ? `Permisos del rol ${rol.name} modificados`
              : `Rol ${rol.name} actualizado`,
            ...requestMeta(req),
          },
          { session, strict: Boolean(session) }
        );
      }

      return rol;
    });

    sendSuccess(res, doc);
  })
);

// DELETE /api/v1/roles/:id — roles de sistema o en uso no se eliminan.
router.delete(
  '/:id',
  authenticate,
  authorize('roles.delete'),
  asyncHandler(async (req, res) => {
    await withTransaction(async (session) => {
      let findQuery = Role.findOne({ _id: req.params.id, companyId: req.user.companyId });
      if (session) findQuery = findQuery.session(session);
      const rol = await findQuery;
      if (!rol) throw new NotFoundError('Rol no encontrado');

      if (rol.isSystem) throw new ConflictError('Los roles del sistema no se pueden eliminar');

      let countQuery = User.countDocuments({ roleId: rol._id, status: 'active' });
      if (session) countQuery = countQuery.session(session);
      const inUse = await countQuery;
      if (inUse > 0) {
        throw new ConflictError(`No se puede eliminar: ${inUse} usuario(s) activo(s) usan este rol`);
      }

      const snapshot = {
        name: rol.name,
        permissions: [...rol.permissions],
        status: rol.status,
        isSystem: rol.isSystem,
      };

      await Role.deleteOne({ _id: rol._id }, session ? { session } : {});

      await recordAudit(
        {
          userId: req.user.id,
          companyId: req.user.companyId,
          action: 'DELETE_ROLE',
          module: 'roles',
          entity: 'role',
          entityId: rol._id,
          newValue: snapshot,
          description: `Rol ${rol.name} eliminado`,
          ...requestMeta(req),
        },
        { session, strict: Boolean(session) }
      );
    });

    sendSuccess(res, { message: 'Rol eliminado' });
  })
);

module.exports = router;
