'use strict';

/**
 * Smoke test rápido contra el servidor en ejecución (puerto 4000).
 * Uso: node scripts/smoke.js   (con el backend levantado)
 */

const BASE = process.env.API_URL || 'http://localhost:4000/api/v1';

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // sin cuerpo JSON
  }
  return { status: res.status, json };
}

function check(label, condition, extra) {
  const ok = condition ? 'OK ' : 'FAIL';
  console.log(`[${ok}] ${label}${extra !== undefined ? ` → ${JSON.stringify(extra)}` : ''}`);
  if (!condition) process.exitCode = 1;
}

async function main() {
  // 1. Salud
  const health = await req('/health');
  check('GET /health', health.status === 200 && health.json?.data?.status === 'ok', health.status);

  // 2. Login inválido
  const badLogin = await req('/auth/login', {
    method: 'POST',
    body: { email: 'admin@demo.local', password: 'mala' },
  });
  check('Login con contraseña incorrecta → 401', badLogin.status === 401, badLogin.status);

  // 3. Login correcto
  const login = await req('/auth/login', {
    method: 'POST',
    body: { email: 'admin@demo.local', password: 'Admin12345!' },
  });
  check('Login correcto → 200 + tokens', login.status === 200 && Boolean(login.json?.data?.accessToken));
  const token = login.json?.data?.accessToken;
  if (!token) return;

  check('Login devuelve permisos', Array.isArray(login.json.data.user?.role?.permissions),
    login.json?.data?.user?.role?.permissions?.length);

  // 4. Endpoint protegido sin token
  const noAuth = await req('/users');
  check('GET /users sin token → 401', noAuth.status === 401, noAuth.status);

  // 5. Listados con token
  const users = await req('/users', { token });
  check('GET /users con token → 200', users.status === 200 && Array.isArray(users.json?.data?.items), {
    total: users.json?.data?.pagination?.total,
  });

  const perms = await req('/permissions', { token });
  check('GET /permissions → 200 (catálogo)', perms.status === 200 && perms.json?.data?.length >= 50,
    Array.isArray(perms.json?.data) ? perms.json.data.length : undefined);

  const roles = await req('/roles', { token });
  check('GET /roles → 200 (6 roles)', roles.status === 200 && roles.json?.data?.length === 6,
    roles.json?.data?.length);

  const companies = await req('/companies', { token });
  check('GET /companies → empresa propia', companies.status === 200 && Boolean(companies.json?.data?.name),
    companies.json?.data?.name);

  const dash = await req('/dashboard', { token });
  check('GET /dashboard → indicadores reales', dash.status === 200 && Boolean(dash.json?.data?.kpi),
    dash.json?.data?.kpi);

  // 6. CRUD de cliente con auditoría
  const customer = await req('/customers', {
    method: 'POST',
    token,
    body: { name: 'Cliente Smoke', email: 'smoke@test.local', phone: '600000000' },
  });
  check('POST /customers → 201 con customerCode', customer.status === 201 && /^CL-\d{5}$/.test(customer.json?.data?.customerCode),
    customer.json?.data?.customerCode);

  const customerId = customer.json?.data?._id;
  const customerUpd = await req(`/customers/${customerId}`, {
    method: 'PATCH',
    token,
    body: { phone: '611111111' },
  });
  check('PATCH /customers/:id → 200', customerUpd.status === 200 && customerUpd.json?.data?.phone === '611111111');

  // 7. Auditoría visible
  const audit = await req('/audit', { token });
  const actions = (audit.json?.data?.items || []).map((a) => a.action);
  check('GET /audit registra CREATE_CUSTOMER', audit.status === 200 && actions.includes('CREATE_CUSTOMER'), actions.slice(0, 5));

  // 8. RBAC: intento sin permiso simulado no es posible aquí (lo cubren las pruebas con rol Consulta)
  console.log('---');
  console.log(process.exitCode ? 'SMOKE TEST: HAY FALLOS' : 'SMOKE TEST: TODO OK');
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
