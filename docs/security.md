# Seguridad — ERP PyMEs

## 1. Autenticación (auth)

| Control | Implementación |
|---|---|
| Contraseñas | bcrypt (cost 10), `select:false`, validación de fuerza (≥8) |
| Access token | JWT firmado (`JWT_SECRET`), 15 min, payload mínimo (`sub`) |
| Refresh token | 7 días, aleatorio (48 bytes), guardado como **hash SHA-256**, **rotado** en cada uso, máx. 5 vivos por usuario |
| Logout | Borra el refresh enviado; `change-password` revoca **todas** las sesiones |
| Bloqueo | `failedLoginAttempts`/`lockUntil`: 5 fallos → 15 min bloqueado (`MAX_LOGIN_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`) |
| Rate limit | Global 1000/15 min; `/auth/login` más agresivo (100/15 min, 30 en prod) |

Cada intento de login (correcto o no) queda en `auditLogs` con IP y
user-agent.

## 2. Autorización (RBAC)

- Modelo **User → Role → Permissions**: `roles.permissions` guarda claves
  del catálogo global (`users.read`, `inventory.entry`, …) — 56 claves.
- **6 roles por empresa** sembrados al aprovisionar: Administrador (todo),
  Gerente, Ventas, Compras, Almacén, Consulta (sólo lectura, sin auditoría).
- Cada endpoint lleva `authorize('<clave>')` en el router — la UI oculta
  botones por comodidad, pero **la autoridad es siempre el backend**.
- Permisos dinámicos: `POST /inventory/movements` exige `inventory.entry`,
  `.exit` o `.adjust` según `type`.

## 3. Multiempresa (aislamiento de datos)

1. `authenticate` deriva `req.user.companyId` **del JWT**; el body/query
   nunca decide la empresa.
2. Todo servicio filtra `{companyId: actor.companyId}`.
3. Id de otra empresa → **404 NOT_FOUND** (no 403: no se revela existencia).
4. Excepción explícita y auditada: `POST /users` admite alta cross-company
   sólo con `companies.create` (grupo empresarial con empresas hermanas).

**Prueba obligatoria**: usuario de Empresa B accediendo a recursos de
Empresa A → 404 (test `multiempresa.test.js`).

## 4. Validación y hardening de entradas

- **Whitelist declarativa** (`utils/validate.js`) por endpoint: claves fuera
  del esquema → `VALIDATION_ERROR` (no se “limpia”, se rechaza).
- **Anti NoSQL injection** (`middlewares/sanitize.js`): rechaza claves que
  empiecen por `$` o contengan `.` en body y query, con límite de
  profundidad (10) y de tamaño (`express.json` 1 MB).
- **CORS** restringido a los orígenes de `CLIENT_URL`; sin origin (curl,
  móvil) se permite porque el JWT ya autentica.
- **helmet** → headers por defecto (HSTS, X-Content-Type-Options, frame
  denial, etc.).
- **Rate limit** global + específico de login, con `trust proxy` para que
  `req.ip` sea el real detrás de proxy.
- **Morgan** off en test; en prod los 500 no filtran stack (sólo en dev).

## 5. Errores y fuga de información

- Jerarquía `ApiError` + `errorHandler` único: siempre
  `{success:false, error:{code,message}}`.
- Errores de Mongoose traducidos: `ValidationError` → 400, `CastError` → 400,
  `11000` (duplicado) → 409, JWT → 401, resto → 500 genérico.
- En producción **no se envía `stack`** ni mensajes internos de Mongo.
- `env.js` hace **fail-fast** al arrancar si faltan secretos o si en prod
  son cortos/iguales entre sí.

## 6. Auditoría

- `auditLogs` **inmutable** (hook `pre` que lanza en cualquier update/delete
  + sin endpoints de escritura).
- Escrita con `{session, strict:true}` dentro de la transacción de la
  operación: o se registra todo, o nada.
- Cubre: login/failed, CRUD de usuarios/roles/empresas/maestros, movimientos
  de stock, altas/confirmaciones/cancelaciones de ventas y compras, cambios
  de settings y exportaciones de reportes.
- Sólo lectura para usuarios normales; `audit.read` reservado a
  Administrador/Gerente (Consulta no lo tiene).

## 7. Inventario y consistencia

- Stock **sólo** cambia vía `applyMovement` (único punto de mutación).
- `$inc` atómico con guardia `$gte` → sin oversell ni descuentos parciales.
- Cada movimiento guarda `previousQuantity`/`newQuantity`, referencia
  (`referenceType/referenceId`), usuario y motivo.
- Confirmar/recibir/cancelar opera en **transacción ACID**: venta + stock +
  movimiento + auditoría se revierten juntos.

## 8. Gestión de secretos

- `.env` en `.gitignore`; `.env.example` sin valores reales.
- Credenciales de Atlas sólo en el backend (el frontend jamás las ve).
- La URI de Mongo se sanea en logs (`//***@` en lugar de usuario:clave).

## 9. Dependencias

135 paquetes totales (hoisted), audit moderado: revisar con
`npm audit` en cada entrega. Sin dependencias exóticas: el validador, el CRUD
y los CSV son código propio (menos superficie de ataque).

## 10. HTTPS

El API se sirve en HTTP dentro de la red; **TLS lo termina el proxy inverso**
o la plataforma de despliegue (spec: HTTPS en producción). Documentado en el
runbook de despliegue.

## 11. Deudas / pendientes de seguridad

- Cifrado en reposo: depende de Atlas/almacenamiento (no del código).
- Refresh token reuse detection: se revoca el hash, pero no se “envenena”
  la familia de tokens.
- MFA / SSO: fuera de alcance (P2 futuro).
