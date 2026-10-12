'use strict';

/**
 * Bootstrap SEGURO de la primera puesta en marcha de CodeEvo ERP.
 *
 * APTO PARA PRODUCCIÓN — a diferencia de seed.js (solo desarrollo), este
 * script inicializa el tenant inicial usando EXCLUSIVAMENTE variables de
 * entorno: sin credenciales hardcodeadas, sin imprimir secretos y protegido
 * por una confirmación explícita para evitar ejecuciones accidentales.
 *
 * Cadena garantizada (idempotente, sin duplicados ni borrados):
 *   catálogo de permisos → empresa → sucursal → almacén → settings
 *   → roles por defecto → rol Administrador → usuario administrador
 *
 * Variables OBLIGATORIAS:
 *   BOOTSTRAP_CONFIRM=CODEEVO_INITIAL_SETUP  (siempre; en producción es el
 *                                            permiso explícito para ejecutar)
 *   BOOTSTRAP_ADMIN_EMAIL                    (email normalizado a minúsculas)
 *   BOOTSTRAP_ADMIN_PASSWORD                 (política del backend: >=8
 *                                            caracteres, con letra y número)
 *   BOOTSTRAP_ADMIN_FIRST_NAME
 *   BOOTSTRAP_ADMIN_LAST_NAME
 *   BOOTSTRAP_COMPANY_NAME
 *
 * Variables OPCIONALES:
 *   BOOTSTRAP_BRANCH_NAME     (default: 'Sucursal Central')
 *   BOOTSTRAP_WAREHOUSE_NAME  (default: 'Almacén Central')
 *
 * NO crea productos, ventas, compras, clientes, proveedores ni movimientos.
 * NO modifica ni elimina información existente.
 * NUNCA muestra ni registra la contraseña en consola.
 *
 * Uso:  npm run bootstrap   (desde apps/backend)
 * La contraseña se guarda hasheada con bcrypt gracias al pre('save') del
 * modelo User (mismo mecanismo que la API).
 */

const env = require('../config/env');
const { connectDB, disconnectDB, withTransaction } = require('../config/db');
const {
  PERMISSION_LIST,
  DEFAULT_ROLES,
  ROLE_PERMISSIONS,
  SETTINGS_DEFAULTS,
} = require('../config/constants');
const { assertPasswordStrength } = require('../utils/password');
const { ValidationError } = require('../utils/errors');
const { EMAIL_RE } = require('../utils/validate');

const Permission = require('../modules/permissions/model');
const Company = require('../modules/companies/model');
const Branch = require('../modules/branches/model');
const Warehouse = require('../modules/warehouses/model');
const Settings = require('../modules/settings/model');
const Role = require('../modules/roles/model');
const User = require('../modules/users/model');

const CONFIRM_KEY = 'BOOTSTRAP_CONFIRM';
const CONFIRM_VALUE = 'CODEEVO_INITIAL_SETUP';
const DEFAULT_BRANCH_NAME = 'Sucursal Central';
const DEFAULT_WAREHOUSE_NAME = 'Almacén Central';

/** Variables sensibles/obligatorias (solo se imprimen SUS NOMBRES si faltan). */
const REQUIRED_VARS = [
  'BOOTSTRAP_ADMIN_EMAIL',
  'BOOTSTRAP_ADMIN_PASSWORD',
  'BOOTSTRAP_ADMIN_FIRST_NAME',
  'BOOTSTRAP_ADMIN_LAST_NAME',
  'BOOTSTRAP_COMPANY_NAME',
];

/** Límites del modelo User para fallar antes de tocar la base. */
const MAX_NAME = 60;
const MAX_COMPANY_NAME = 120;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Valida toda la configuración ANTES de conectar a MongoDB.
 * Lanza ValidationError; los mensajes incluyen nombres de variables,
 * jamás sus valores (ni la contraseña).
 */
function parseBootstrapConfig(source = process.env) {
  // 1) Confirmación explícita — evita ejecuciones accidentales en cualquier
  //    entorno y, en producción, exige intención deliberada del operador.
  if (source[CONFIRM_KEY] !== CONFIRM_VALUE) {
    throw new ValidationError(
      `Bootstrap cancelado: falta confirmación explícita ` +
        `(${CONFIRM_KEY} debe ser exactamente ${CONFIRM_VALUE}).`
    );
  }

  // 2) Variables obligatorias — sólo se listan los NOMBRES que faltan.
  const missing = REQUIRED_VARS.filter((key) => !clean(source[key]));
  if (missing.length > 0) {
    throw new ValidationError(
      `Bootstrap cancelado: faltan variables obligatorias: ${missing.join(', ')}.`
    );
  }

  // 3) Email normalizado igual que lo hace la API (trim + minúsculas).
  const email = clean(source.BOOTSTRAP_ADMIN_EMAIL).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new ValidationError('Bootstrap cancelado: BOOTSTRAP_ADMIN_EMAIL no es un email válido.');
  }

  // 4) Política de contraseña EXISTENTE del backend (utils/password).
  try {
    assertPasswordStrength(source.BOOTSTRAP_ADMIN_PASSWORD);
  } catch (err) {
    throw new ValidationError(
      'Bootstrap cancelado: BOOTSTRAP_ADMIN_PASSWORD no cumple la política del backend.',
      (err.details || []).map((d) => ({
        field: 'BOOTSTRAP_ADMIN_PASSWORD',
        message: d.message,
      }))
    );
  }

  // 5) Longitudes de los modelos (fallar aquí, no en mitad de la transacción).
  const firstName = clean(source.BOOTSTRAP_ADMIN_FIRST_NAME);
  const lastName = clean(source.BOOTSTRAP_ADMIN_LAST_NAME);
  const companyName = clean(source.BOOTSTRAP_COMPANY_NAME);
  const tooLong = [];
  if (firstName.length > MAX_NAME) tooLong.push(`BOOTSTRAP_ADMIN_FIRST_NAME (max ${MAX_NAME})`);
  if (lastName.length > MAX_NAME) tooLong.push(`BOOTSTRAP_ADMIN_LAST_NAME (max ${MAX_NAME})`);
  if (companyName.length > MAX_COMPANY_NAME) tooLong.push(`BOOTSTRAP_COMPANY_NAME (max ${MAX_COMPANY_NAME})`);
  if (tooLong.length > 0) {
    throw new ValidationError(`Bootstrap cancelado: valor demasiado largo: ${tooLong.join(', ')}.`);
  }

  return {
    company: { name: companyName, legalName: companyName },
    branchName: clean(source.BOOTSTRAP_BRANCH_NAME) || DEFAULT_BRANCH_NAME,
    warehouseName: clean(source.BOOTSTRAP_WAREHOUSE_NAME) || DEFAULT_WAREHOUSE_NAME,
    admin: { firstName, lastName, email, password: source.BOOTSTRAP_ADMIN_PASSWORD },
  };
}

/** Catálogo GLOBAL de permisos (upsert idempotente por `key`). */
async function ensurePermissions() {
  await Permission.bulkWrite(
    PERMISSION_LIST.map((p) => ({
      updateOne: { filter: { key: p.key }, update: { $set: p }, upsert: true },
    }))
  );
  console.log(`[bootstrap] Permisos del catálogo: ${PERMISSION_LIST.length}`);
}

async function ensureCompany(cfg, session) {
  const existing = await Company.findOne({ name: cfg.company.name }).session(session || null);
  if (existing) {
    console.log(`[bootstrap] Empresa ya existente: ${existing.name}`);
    return existing;
  }
  const [company] = await Company.create(
    [{ name: cfg.company.name, legalName: cfg.company.legalName, status: 'active' }],
    session ? { session } : {}
  );
  console.log(`[bootstrap] Empresa creada: ${company.name}`);
  return company;
}

async function ensureBranch(companyId, cfg, session) {
  const existing = await Branch.findOne({ companyId, name: cfg.branchName }).session(session || null);
  if (existing) {
    console.log(`[bootstrap] Sucursal ya existente: ${existing.name}`);
    return existing;
  }
  const [doc] = await Branch.create(
    [{ name: cfg.branchName, companyId }],
    session ? { session } : {}
  );
  console.log(`[bootstrap] Sucursal creada: ${doc.name}`);
  return doc;
}

async function ensureWarehouse(companyId, branchId, cfg, session) {
  const existing = await Warehouse.findOne({ companyId, name: cfg.warehouseName }).session(session || null);
  if (existing) {
    console.log(`[bootstrap] Almacén ya existente: ${existing.name}`);
    return existing;
  }
  const [doc] = await Warehouse.create(
    [{ name: cfg.warehouseName, branchId, companyId }],
    session ? { session } : {}
  );
  console.log(`[bootstrap] Almacén creado: ${doc.name}`);
  return doc;
}

async function ensureSettings(companyId, session) {
  const existing = await Settings.findOne({ companyId }).session(session || null);
  if (existing) {
    console.log('[bootstrap] Ajustes ya existentes');
    return existing;
  }
  const [doc] = await Settings.create(
    [{ companyId, ...SETTINGS_DEFAULTS }],
    session ? { session } : {}
  );
  console.log('[bootstrap] Ajustes por defecto creados');
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
      console.log(`[bootstrap] Rol creado: ${name}`);
    } else {
      console.log(`[bootstrap] Rol ya existente: ${name}`);
    }
    roles[name] = role;
  }
  return roles;
}

async function ensureAdmin(cfg, company, adminRole, session) {
  const existing = await User.findOne({ email: cfg.admin.email }).session(session || null);
  if (existing) {
    // Email global: si ya existe (en cualquier empresa) NO se toca nada.
    console.log(`[bootstrap] Usuario administrador ya existente: ${existing.email}`);
    return existing;
  }
  // `new User(...).save()` garantiza el pre('save') que aplica bcrypt.
  const user = new User({
    firstName: cfg.admin.firstName,
    lastName: cfg.admin.lastName,
    email: cfg.admin.email,
    password: cfg.admin.password,
    roleId: adminRole._id,
    companyId: company._id,
    status: 'active',
  });
  await user.save(session ? { session } : {});
  console.log(`[bootstrap] Usuario administrador creado: ${user.email}`);
  return user;
}

/**
 * Ejecuta el bootstrap completo. Idempotente: una segunda ejecución no
 * duplica permisos, empresa, sucursal, almacén, settings, roles ni usuarios.
 */
async function runBootstrap(source = process.env) {
  const cfg = parseBootstrapConfig(source); // valida ANTES de conectar

  await connectDB();
  try {
    await ensurePermissions();

    await withTransaction(async (session) => {
      const company = await ensureCompany(cfg, session);
      const branch = await ensureBranch(company._id, cfg, session);
      await ensureWarehouse(company._id, branch._id, cfg, session);
      await ensureSettings(company._id, session);
      const roles = await ensureRoles(company._id, session);
      await ensureAdmin(cfg, company, roles.Administrador, session);
    });

    console.log('[bootstrap] Empresa lista');
    console.log('[bootstrap] Roles listos');
    console.log('[bootstrap] Usuario administrador listo');
    console.log(`[bootstrap] Email del administrador: ${cfg.admin.email}`);
    console.log('[bootstrap] Inicialización completada');
  } finally {
    await disconnectDB();
  }
}

/** Imprime el error SIN secretos (sólo mensaje + detalles de validación). */
function printError(err) {
  console.error(`[bootstrap] ${err.message}`);
  if (Array.isArray(err.details)) {
    for (const d of err.details) {
      console.error(`[bootstrap]   - ${d.field}: ${d.message}`);
    }
  }
}

if (require.main === module) {
  runBootstrap().catch((err) => {
    printError(err);
    process.exit(1);
  });
}

module.exports = { parseBootstrapConfig, runBootstrap };
