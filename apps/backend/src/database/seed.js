'use strict';

/**
 * Seed idempotente del ERP (desarrollo / primera puesta en marcha).
 *
 * Crea (si no existen):
 *  1. Catálogo GLOBAL de permisos (permissions)
 *  2. Empresa demo "Distribuciones Demo S.L."
 *  3. Sucursal "Sucursal Central"
 *  4. Almacén "Almacén Central"
 *  5. Ajustes por defecto (taxRate, allowNegativeStock)
 *  6. Los 6 roles por defecto de la empresa
 *  7. Usuario administrador (SOLO DESARROLLO)
 *
 * Uso:  npm run seed   (desde apps/backend)
 * Seguro de ejecutar varias veces.
 */

const env = require('../config/env');
const { connectDB, disconnectDB, withTransaction } = require('../config/db');
const { PERMISSION_LIST, DEFAULT_ROLES, ROLE_PERMISSIONS, SETTINGS_DEFAULTS } = require('../config/constants');

const Permission = require('../modules/permissions/model');
const Company = require('../modules/companies/model');
const Branch = require('../modules/branches/model');
const Warehouse = require('../modules/warehouses/model');
const Settings = require('../modules/settings/model');
const Role = require('../modules/roles/model');
const User = require('../modules/users/model');

const DEMO_COMPANY = 'Distribuciones Demo S.L.';
const DEMO_BRANCH = 'Sucursal Central';
const DEMO_WAREHOUSE = 'Almacén Central';
const ADMIN_EMAIL = 'admin@demo.local';
const ADMIN_PASSWORD = 'Admin12345!'; // SOLO DESARROLLO

async function seedPermissions() {
  await Permission.bulkWrite(
    PERMISSION_LIST.map((p) => ({
      updateOne: { filter: { key: p.key }, update: { $set: p }, upsert: true },
    }))
  );
  console.log(`[seed] Permisos del catálogo: ${PERMISSION_LIST.length}`);
}

async function ensureCompany(session) {
  const existing = await Company.findOne({ name: DEMO_COMPANY }).session(session || null);
  if (existing) {
    console.log(`[seed] Empresa ya existente: ${existing.name}`);
    return { company: existing, created: false };
  }
  const [company] = await Company.create(
    [{ name: DEMO_COMPANY, legalName: 'Distribuciones Demo S.L.', taxId: 'B-00000000', email: 'contacto@demo.local', status: 'active' }],
    session ? { session } : {}
  );
  console.log(`[seed] Empresa creada: ${company.name}`);
  return { company, created: true };
}

async function ensureBranch(companyId, session) {
  const existing = await Branch.findOne({ companyId, name: DEMO_BRANCH }).session(session || null);
  if (existing) return existing;
  const [doc] = await Branch.create(
    [{ name: DEMO_BRANCH, address: 'Calle Mayor 1', companyId }],
    session ? { session } : {}
  );
  console.log(`[seed] Sucursal creada: ${doc.name}`);
  return doc;
}

async function ensureWarehouse(companyId, branchId, session) {
  const existing = await Warehouse.findOne({ companyId, name: DEMO_WAREHOUSE }).session(session || null);
  if (existing) return existing;
  const [doc] = await Warehouse.create(
    [{ name: DEMO_WAREHOUSE, branchId, companyId }],
    session ? { session } : {}
  );
  console.log(`[seed] Almacén creado: ${doc.name}`);
  return doc;
}

async function ensureSettings(companyId, session) {
  const existing = await Settings.findOne({ companyId }).session(session || null);
  if (existing) return existing;
  const [doc] = await Settings.create(
    [{ companyId, ...SETTINGS_DEFAULTS }],
    session ? { session } : {}
  );
  console.log('[seed] Ajustes por defecto creados');
  return doc;
}

async function ensureRoles(companyId, session) {
  const roles = {};
  for (const name of DEFAULT_ROLES) {
    let role = await Role.findOne({ companyId, name }).session(session || null);
    if (!role) {
      [role] = await Role.create(
        [{ name, companyId, permissions: ROLE_PERMISSIONS[name], isSystem: true, status: 'active' }],
        session ? { session } : {}
      );
      console.log(`[seed] Rol creado: ${name}`);
    }
    roles[name] = role;
  }
  return roles;
}

async function ensureAdmin(company, adminRole, session) {
  const existing = await User.findOne({ email: ADMIN_EMAIL }).session(session || null);
  if (existing) {
    console.log(`[seed] Usuario admin ya existente: ${existing.email}`);
    return existing;
  }
  const [user] = await User.create(
    [
      {
        firstName: 'Admin',
        lastName: 'Demo',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        roleId: adminRole._id,
        companyId: company._id,
        status: 'active',
      },
    ],
    session ? { session } : {}
  );
  console.log(`[seed] Usuario administrador creado: ${user.email}`);
  return user;
}

async function main() {
  if (env.isProd) {
    throw new Error('El seed de desarrollo no puede ejecutarse en producción.');
  }

  await connectDB();

  try {
    await seedPermissions();

    // Provisionamiento completo del tenant dentro de una transacción.
    await withTransaction(async (session) => {
      const { company } = await ensureCompany(session);
      const branch = await ensureBranch(company._id, session);
      const warehouse = await ensureWarehouse(company._id, branch._id, session);
      await ensureSettings(company._id, session);
      const roles = await ensureRoles(company._id, session);
      await ensureAdmin(company, roles.Administrador, session);
      console.log(`[seed] Almacén por defecto: ${warehouse.name}`);
    });

    console.log('-----------------------------------------------');
    console.log('[seed] Seed completado correctamente.');
    if (env.env !== 'production') {
      console.log('[seed] CREDENCIALES DE DESARROLLO (no usar en producción):');
      console.log(`[seed]   email:    ${ADMIN_EMAIL}`);
      console.log(`[seed]   password: ${ADMIN_PASSWORD}`);
    }
    console.log('-----------------------------------------------');
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error('[seed] Error:', err.message);
  process.exit(1);
});
