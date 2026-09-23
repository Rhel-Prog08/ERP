# Arquitectura — ERP PyMEs

## 1. Visión general

Monolito modular: **una sola aplicación Node.js** con módulos aislados por
carpeta, en lugar de microservices. Cada módulo expone su router, servicio y
modelo; el núcleo (env, DB, middlewares, utils) no conoce la lógica de
negocio.

```
┌────────────────────────────┐      HTTPS/REST       ┌─────────────────────────────┐
│  Frontend (apps/frontend)  │ ────────────────────► │  Backend (apps/backend)     │
│  React Native + RN Web     │  JSON {success,data}  │  Express (Node.js)          │
│  Expo SDK 57 · TypeScript  │ ◄──────────────────── │  /api/v1/*                  │
└────────────────────────────┘   Bearer JWT (15 min) └──────────────┬──────────────┘
  · 14 pantallas                + refresh (7 d)                    │ Mongoose
  · Context (auth/permisos)                                      │ transacciones
  · fetch centralizado                                           ▼ (replica set)
                                                    ┌─────────────────────────────┐
                                                    │ MongoDB (Atlas o local rs0) │
                                                    │ multiempresa por companyId  │
                                                    └─────────────────────────────┘
```

Regla de oro: **el frontend y Kotlin nunca tocan la base de datos**; sólo el
backend habla con MongoDB, y siempre filtrando por `companyId` del token.

## 2. Capas del backend

```
HTTP → helmet/CORS/rate-limit/sanitize
     → routes/index.js (prefijo /api/v1)
     → authenticate (JWT → req.user{companyId, role.permissions})
     → authorize('x.y') (RBAC)
     → validate / validateQuery (whitelist declarativa)
     → controller delgado
     → service (lógica de negocio + transacciones + auditoría)
     → Mongoose (modelo del módulo)
     → errorHandler global (envelope de error tipado)
```

Patrones clave:

| Patrón | Dónde | Para qué |
|---|---|---|
| **CRUD factory** | `utils/crudFactory.js` | Módulos maestros (customers, suppliers, categories, products, branches, warehouses) comparten listado paginado + create + update + baja lógica con auditoría. `categories` refuerza con `beforeDelete`: no se desactiva si hay productos activos usándola |
| **Validador declarativo** | `utils/validate.js` | Whitelists `{campo: {type, required, min…}}`; rechaza claves fuera de esquema (defense-in-depth anti-injection) |
| **Jerarquía de errores** | `utils/errors.js` | `ApiError` → Validation/Authentication/Authorization/NotFound/Conflict/Database/Internal; un único errorHandler los serializa |
| **Transacciones** | `config/db.js#withTransaction` | Si el servidor es replica set usa sesión real; si no, ejecuta sin sesión y avisa (comportamiento degradado consciente) |
| **Auditoría** | `modules/audit/service.js#recordAudit` | Se invoca DENTRO de la transacción de cada operación crítica (`strict:true`) → si falla la operación, no queda registro huérfano |
| **Permisos dinámicos** | `utils/assertPermission.js` + `MOVEMENT_PERMISSION` | Un mismo endpoint (`POST /inventory/movements`) exige `inventory.entry/exit/adjust` según el tipo de movimiento |

## 3. Módulos (19)

| Grupo | Módulos | Naturaleza |
|---|---|---|
| Identidad y control | auth, users, roles, permissions, audit | RBAC + bitácora |
| Organización | companies, branches, warehouses, settings | multiempresa |
| Maestros | customers, suppliers, categories, products | CRUD factory |
| Operaciones | inventory, sales, purchases | servicios transaccionales |
| Visibilidad | dashboard, reports, notifications | agregaciones/lectura |

> El inventario usa `stockBalances` + `stockMovements` (ver
> [database.md](database.md)); notificaciones `LOW_STOCK` se generan desde
> `inventory/service.js#notifyLowStock` cuando una salida cruza el mínimo.

Estructura interna típica de un módulo:

```
modules/<nombre>/
├── model.js        # esquema Mongoose (índices, companyId, defaults)
├── routes.js       # endpoints + middlewares (authenticate/authorize/validate)
├── service.js      # lógica + transacciones + auditoría (si no hay controller)
├── controller.js   # opcional: delgada, cuando la lógica es grande (auth, sales, purchases)
└── validation.js   # whitelists de body/query exportadas a routes
```

## 4. Ciclo de vida de una operación crítica (ej. confirmar venta)

1. `POST /sales/:id/confirm` → `authenticate` (JWT) → `authorize('sales.update')`.
2. `withTransaction(session)`:
   - carga la venta de **la empresa del token** (404 si es de otra);
   - valida estado `DRAFT`;
   - `inventory.applyMovement(EXIT)` → `$inc` atómico con guardia `$gte`
     (409 `Stock insuficiente` si no alcanza) + crea `stockMovements` con
     `previousQuantity/newQuantity` y `referenceType:'sale' / referenceId`;
   - actualiza estado `CONFIRMED`;
   - `recordAudit(CONFIRM_SALE, {session, strict:true})`.
3. Cualquier fallo revierte TODO (stock, movimiento, estado y auditoría).

Cancelaciones: mismo patrón con movimiento **inverso** (`RETURN` para ventas,
`EXIT` para compras recibidas) + campos `cancelledBy/cancelledAt/cancelReason`.

## 5. Multiempresa

- Toda colección operativa lleva `companyId` (índice en casi todas).
- `authenticate` deriva `req.user.companyId` **del token**, nunca del body:
  la petición no decide a qué empresa pertenece.
- Los servicios filtran siempre `{companyId: actor.companyId}`; un id ajeno
  devuelve **404** (no 403) para no filtrar la existencia de datos ajenos.
- `POST /companies` aprovisiona la nueva empresa de forma atómica (6 roles,
  almacén principal, settings); el alta se audita en la empresa del ACTOR.
- Excepción documentada: `POST /users` admite alta cross-company únicamente
  con `companies.create`, para que un administrador pueda dar de alta usuarios
  en empresas hermanas del mismo grupo.

## 6. Frontend

```
src/
├── components/     # Button, Input, Modal, DataTable, Pagination, Badge,
│                   # ConfirmDialog, Card, KpiCard, EmptyState, Select, Layout(AppShell)
├── screens/        # 14 pantallas (Login…Settings)
├── navigation/     # RootNavigator: sin sesión → Login; con sesión → shell + stack
├── services/       # apiClient (fetch + refresh automático) + un service por módulo
├── stores/         # AuthContext (user, tokens, permisos) + useAsync
├── hooks/          # usePermissions, useApi
├── utils/          # formatCurrency, formatDate, buildQuery
├── constants/      # permissions, statuses
└── types/          # interfaces TS espejo del API
```

- **Un único punto de acceso HTTP** (`services/apiClient.ts`): adjunta el
  Bearer, traduce el envelope, y ante un 401 intenta **una** vez
  `POST /auth/refresh` y reintenta la petición; si falla, cierra sesión.
- **Permisos en UI**: `usePermissions().has('sales.create')` oculta o
  deshabilita acciones. Es **sólo comodidad**: la autoridad real sigue siendo
  el backend (nunca se confía en la UI).
- **Responsive**: `useWindowDimensions` — ≥1024 sidebar fija, 768–1023
  colapsada, <768 menú hamburguesa; mismo código RN/RN Web (max. code sharing).

## 7. Decisiones y alternativas descartadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Monolito modular | Microservices | Alcance académico; operación 1 persona; las transacciones ACID cruzan mejor en un proceso |
| Validador propio declarativo | Joi/Zod/express-validator | Dependencias mínimas; whitelist estricta que además bloquea claves raras |
| CRUD factory | Capa de servicios 1:1 por maestro | 6 módulos idénticos → un solo archivo testeado |
| node:test + supertest | Jest | Runner nativo, cero dependencias extra, arranque rápido |
| Context + fetch | Redux/axios | Estado global mínimo (auth); fetch cubre el envelope y el refresh |
| MongoDB transactions con fallback | Exigir replica set | Paridad local/Atlas y degradación explícita con aviso |
| Baja lógica (`status: inactive`) | Borrado físico | Trazabilidad e integridad referencial (auditLogs, ventas) |

## 8. Fronteras de seguridad (resumen)

1. **Red**: CORS restringido a `CLIENT_URL`; helmet; rate limit global y
   agresivo en `/auth/login`.
2. **Entrada**: `sanitizeInput` rechaza claves `$…`/con punto (NoSQL injection)
   + whitelist por endpoint.
3. **Identidad**: JWT 15 min + refresh rotado (hash SHA-256, máx. 5) +
   bloqueo por intentos.
4. **Autorización**: `authorize(<permiso>)` en **cada** ruta.
5. **Aislamiento**: `companyId` del token en cada query.
6. **Persistencia**: transacciones ACID; stock sólo vía `applyMovement`;
   auditoría inmutable dentro de la misma transacción.
7. **Fuga**: envelopes sin stack traces en prod; `.env` fuera de git;
   credenciales Atlas sólo en el backend.

Detalle en [security.md](security.md).
