# Base de datos — ERP PyMEs

MongoDB (Mongoose 8) con **replica set** (Atlas gestionado; en local
`mongod --replSet rs0`) para transacciones ACID.

## 1. Colecciones (19)

### Identidad y control

| Colección | Claves principales | Índices |
|---|---|---|
| `users` | firstName, lastName, **email único global**, password (bcrypt, `select:false`), roleId, **companyId**, status, failedLoginAttempts/lockUntil (bloqueo), refreshTokens[] (hash SHA-256), lastLoginAt | `{companyId,status}`, `{companyId,roleId}`, `email` unique |
| `roles` | name, **companyId**, permissions[] (claves del catálogo), isSystem, status | `{companyId,name}` **unique**, `{companyId,status}` |
| `permissions` | **key única global** (`users.read`), module, action, description | `key` unique, `{module}` — *no* multiempresa |
| `auditLogs` | userId, **companyId**, action (enum), module, entity, entityId, previousValue, newValue, description, ip, userAgent, createdAt | `{companyId,createdAt}`, `{companyId,action}`, `{entity,entityId}` |

`auditLogs` es **inmutable**: un `pre` hook de Mongoose lanza error en
cualquier `update*/delete*` y no existe endpoint de escritura.

### Organización

| Colección | Claves principales | Índices |
|---|---|---|
| `companies` | name, legalName, taxId, phone, email, address, status | `{name}`, `{status}` |
| `branches` | name, address, phone, status, **companyId** | `{companyId,name}` unique |
| `warehouses` | name, branchId (null = matriz), status, **companyId** | `{companyId,name}` unique, `{companyId,branchId}` |
| `settings` | **companyId único** (singleton), taxRate (0–1, def. 0.21), allowNegativeStock (def. false) | `companyId` unique |

### Maestros (todos con baja lógica `status: active|inactive`)

| Colección | Código humano | Índices únicos |
|---|---|---|
| `customers` | `customerCode` (CL-00001) | `{companyId,customerCode}` |
| `suppliers` | `supplierCode` (PR-00001) | `{companyId,supplierCode}` |
| `categories` | — (nombre) | `{companyId,name}` |
| `products` | `sku` | `{companyId,sku}`; `{companyId,name}`, `{companyId,categoryId}` |

`products` **no guarda existencias**: sólo ficha (precios, stockMin, unit).

### Inventario (2 colecciones)

| Colección | Contenido | Índices |
|---|---|---|
| `stockBalances` | existencia actual por producto+almacén: {productId, warehouseId, quantity, companyId} | `{companyId,productId,warehouseId}` **unique** |
| `stockMovements` | cada cambio: type (ENTRY/EXIT/ADJUSTMENT/RETURN), quantity, **previousQuantity, newQuantity**, referenceType/referenceId (SALE/PURCHASE/MANUAL), userId, reason, companyId, createdAt | `{productId,warehouseId,createdAt}`, `{companyId,createdAt}`, `{referenceType,referenceId}` |

> Invariante: **nunca cambia `quantity` sin crear su `stockMovement`**.
> Sólo `inventory/service.js#applyMovement` escribe stock, con `$inc`
> atómico + guardia `$gte` (o valor absoluto en ADJUSTMENT).

### Operaciones

| Colección | Estados | Notas |
|---|---|---|
| `sales` | DRAFT → CONFIRMED → COMPLETED / CANCELLED | items[] con **snapshot** (sku, name, quantity, unitPrice, subtotal), subtotal/tax/total calculados en servidor, warehouseId, createdBy, confirmedAt/completedAt, cancelledBy/cancelledAt/cancelReason |
| `purchases` | DRAFT → CONFIRMED → RECEIVED / CANCELLED | mismo patrón; `receivedAt`; recibir actualiza `product.purchasePrice` |

Índices comunes: `{companyId,createdAt}`, `{companyId,status,createdAt}`,
`{customerId|supplierId,createdAt}`, `{warehouseId}`.

### Visibilidad

| Colección | Contenido |
|---|---|
| `notifications` | companyId, type (`LOW_STOCK`), title, message, productId, read |
| *(no hay más)* | dashboard y reports son **consultas agregadas en vivo**, no colecciones |

## 2. Multiempresa

- `companyId` presente en **todas** las colecciones operativas (excepto
  `permissions`, catálogo global, y `companies`, que es la raíz).
- Los servicios filtran siempre por `req.user.companyId` (derivado del JWT).
- Un ObjectId de otra empresa → `404 NOT_FOUND` (no se revela existencia).

## 3. Transacciones

`config/db.js#withTransaction(fn)`:

1. Comprueba en la conexión (`hello`) si es replica set → `txSupported`.
2. Si lo es: `session.withTransaction()` (rollback automático).
3. Si no: rechaza con `503 TRANSACTIONS_UNAVAILABLE` antes de ejecutar `fn`;
   nunca ejecuta la operación sin sesión.

Operaciones transaccionales: crear empresa (+roles+almacén+settings),
alta/edición de usuarios y roles, confirmar/recibir/cancelar ventas y
compras (+stock+movimiento+auditoría en el mismo commit), movimientos
manuales de inventario, cambios de settings.

Patrón de auditoría: `recordAudit(..., {session, strict:true})` — si la
transacción revierte, no queda entrada huérfana.

## 4. Códigos humanos

`database/sequence.js` genera secuencias incrementales por empresa y
prefijo (`CL-00001`, `PR-00001`) con upsert atómico, evitando colisiones
en altas concurrentes.

## 5. Semillero (seed)

`node src/database/seed.js` (idempotente):

1. Catálogo de 56 permisos (desde `config/constants.js`).
2. Empresa demo "Distribuciones Demo S.L." + sucursal + almacén.
3. `settings` por defecto (taxRate 0.21).
4. 6 roles (Administrador con todos los permisos; Gerente; Ventas; Compras;
   Almacén; Consulta de sólo lectura).
5. Usuario admin con todos los permisos.

Repitable sin duplicados: cada paso consulta existencia antes de crear.
El seed contiene un usuario demo con credenciales solo de desarrollo y rechaza
la ejecución cuando `NODE_ENV=production`.

## 6. Copias de seguridad y purga

- **Atlas**: pit diario automático (35 días) en M0/M10+.
- **Local**: `mongodump --db erp --out <dir>` / `mongorestore`.
- Purga de pruebas: `run.js` hace `dropDatabase()` sobre `erp_test` antes
  de cada archivo de test (ejecución serializada).
