# API REST — ERP v1

Referencia completa del API. Prefijo: **`/api/v1`**.

## Convenciones

### Envelope (sobre)

```jsonc
// Éxito
{ "success": true, "data": … }

// Error
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos de entrada inválidos",
    "details": [{ "field": "email", "message": "Formato de email no válido" }]
  }
}
```

`details` sólo aparece en errores de validación (400).

### Códigos de error

| HTTP | `error.code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Entrada inválida (whitelist del validador, ObjectId mal formado, JSON malformado) |
| 401 | `AUTHENTICATION_ERROR` | Sin token, token inválido/expirado, credenciales malas, usuario bloqueado, refresh revocado |
| 403 | `AUTHORIZATION_ERROR` | Token válido pero sin el permiso exigido |
| 404 | `NOT_FOUND` | Recurso inexistente **o de otra empresa** (aislamiento multiempresa) |
| 409 | `CONFLICT` | SKU duplicado, stock insuficiente, rol en uso, doble recepción… |
| 429 | `RATE_LIMITED` | Demasiadas peticiones (rate limit) |
| 500 | `INTERNAL_ERROR` | Fallo inesperado (en prod sin detalles internos) |

### Autenticación

```
Authorization: Bearer <accessToken>
```

- **Access token JWT**: 15 min (`JWT_EXPIRES_IN`).
- **Refresh token**: 7 días, se envía sólo en `POST /auth/refresh` y
  `POST /auth/logout`. El servidor guarda únicamente su hash SHA-256 y lo
  **rota** en cada uso (máx. 5 sesiones simultáneas por usuario).

### Paginación

Listados: query `?page=1&limit=20` (limit máx. 100) →
`data = { items: [...], pagination: { page, limit, total, totalPages } }`.

Filtros comunes: `q` (búsqueda), `status`, `sort` (ej. `-createdAt`),
`dateFrom`/`dateTo` (ISO). Cada endpoint documenta los suyos.

---

## 1. auth

| Método | Ruta | Auth | Permiso | Descripción |
|---|---|---|---|---|
| POST | `/auth/login` | — | — | Login (rate limit propio) |
| POST | `/auth/refresh` | — | — | Rota el refresh token y emite novo access |
| POST | `/auth/logout` | — | — | Revoca el refresh enviado (idempotente) |
| POST | `/auth/change-password` | ✔ | — | Cambio con sesión activa |
| GET | `/auth/me` | ✔ | — | Perfil + `role.permissions` |

```jsonc
// POST /auth/login — request
{ "email": "admin@demo.local", "password": "Admin12345!" }

// response 200
{
  "success": true,
  "data": {
    "user": { "id": "…", "name": "…", "email": "…",
              "company": { "id": "…", "name": "…" },
              "role": { "id": "…", "name": "Administrador",
                        "permissions": ["users.read", "…"] } },
    "accessToken": "eyJ…",
    "refreshToken": "a1b2…",
    "expiresIn": 900
  }
}
```

Bloqueo: tras `MAX_LOGIN_ATTEMPTS` (5) fallos consecutivos el usuario queda
bloqueado `LOCK_TIME` (15 min) → 401 aunque la contraseña sea correcta.
Cada intento (fallido o correcto) queda en `auditLogs` (`LOGIN_FAILED`/`LOGIN`).

## 2. users

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/users` `?q&page&limit` | `users.read` |
| GET | `/users/:id` | `users.read` |
| POST | `/users` | `users.create` |
| PATCH | `/users/:id` | `users.update` |
| DELETE | `/users/:id` | `users.delete` (baja lógica + revoca sesiones) |

`POST { name, email, password, roleId }` — la empresa se toma del token.
Guards: nadie se desactiva a sí mismo; el email es único global.

## 3. roles y permissions

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/roles` · `/roles/:id` | `roles.read` |
| POST | `/roles` | `roles.create` |
| PATCH | `/roles/:id` | `roles.update` |
| DELETE | `/roles/:id` | `roles.delete` |
| GET | `/permissions` | `permissions.read` |

`POST/PATCH { name?, permissions: ["products.read", …], status? }` — las claves
se validan contra el catálogo global (clave desconocida → 400).
Guards: no puedes modificar los permisos de **tu** rol (409); roles `isSystem`
o en uso no se borran (409).

## 4. companies, branches, warehouses, settings

| Método | Ruta | Permiso | Notas |
|---|---|---|---|
| GET | `/companies` | `companies.read` | Devuelve **siempre la propia** |
| POST | `/companies` | `companies.create` | Aprovisiona almacén + settings + 6 roles (transaccional) |
| PATCH | `/companies/:id` | `companies.update` | Sólo la propia; otra → 404 |
| CRUD | `/branches`, `/warehouses` | `<m>.read/create/update/delete` | CRUD estándar |
| GET | `/settings` | `settings.read` | Singleton por empresa (find-or-create) |
| PATCH | `/settings` | `settings.update` | `{ taxRate, allowNegativeStock }` + auditoría |

## 5. customers, suppliers, categories, products

CRUD estándar (`createCrud`): `GET /` (paginado + filtros), `GET /:id`,
`POST /`, `PATCH /:id`, `DELETE /:id` (baja lógica `status: inactive`).

Permisos `<módulo>.read|create|update|delete`.

```jsonc
// POST /products
{
  "sku": "PANT-001", "name": "Pantalón vaquero",
  "categoryId": "…", "supplierId": "…",
  "purchasePrice": 18.5, "salePrice": 29.9,
  "stockMin": 5, "unit": "unidad"
}
// SKU duplicado en la MISMA empresa → 409 CONFLICT
```

Filtros de `/products`: `q, status, categoryId, supplierId, sort`.

## 6. inventory

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/inventory` | `inventory.read` |
| GET | `/inventory/movements` | `inventory.read` |
| POST | `/inventory/movements` | según tipo: `inventory.entry` / `.exit` / `.adjust` |

`GET /inventory` filtros: `q, warehouseId, productId, lowStock=true, sort`
(quantity, sku, name…). Devuelve balances (`stockBalances`).

`GET /inventory/movements` filtros: `productId, warehouseId, type, userId,
dateFrom, dateTo`. Devuelve el histórico inmutable (`previousQuantity`,
`newQuantity`, `referenceType/referenceId`, `userId`, `reason`).

```jsonc
// POST /inventory/movements
{ "productId": "…", "warehouseId": "…",
  "type": "ENTRY", "quantity": 10, "reason": "Recepción proveedor" }
// type: ENTRY | EXIT | ADJUSTMENT | RETURN
// EXIT por encima del stock → 409 "Stock insuficiente" (sin cambio parcial)
// ADJUSTMENT: quantity es el valor ABSOLUTO final
```

## 7. sales

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/sales` `?status&customerId&warehouseId&dateFrom&dateTo` | `sales.read` |
| GET | `/sales/:id` | `sales.read` |
| POST | `/sales` | `sales.create` |
| POST | `/sales/:id/confirm` | `sales.update` |
| POST | `/sales/:id/complete` | `sales.update` |
| POST | `/sales/:id/cancel` | `sales.cancel` |

Estados: `DRAFT → CONFIRMED → COMPLETED` · `→ CANCELLED`.

```jsonc
// POST /sales (borrador; totales los calcula el servidor)
{
  "customerId": "…", "warehouseId": "…",
  "items": [{ "productId": "…", "quantity": 2, "unitPrice": 29.9 }],
  "notes": "opcional"
}
// confirm: descuenta stock (EXIT) en transacción; sin stock → 409 y sigue DRAFT
// cancel: { "cancelReason": "…" } → movimiento inverso RETURN + campos
//         cancelledBy/cancelledAt/cancelReason
```

## 8. purchases

Mismo patrón que sales:

| Método | Ruta | Permiso |
|---|---|---|
| GET/POST | `/purchases` (+ filtros) | `purchases.read` / `.create` |
| POST | `/purchases/:id/confirm` | `purchases.update` |
| POST | `/purchases/:id/receive` | `purchases.update` |
| POST | `/purchases/:id/cancel` `{cancelReason}` | `purchases.cancel` |

Estados: `DRAFT → CONFIRMED → RECEIVED` · `→ CANCELLED`.
`receive` incrementa stock (ENTRY) y actualiza `product.purchasePrice`;
recibir dos veces → 409. Cancelar una RECEIVED devuelve el stock (EXIT inverso).

## 9. dashboard

`GET /dashboard` (`dashboard.read`) → indicadores **reales** agregados de la
BD de la empresa del token (números ficticios imposibles):

```jsonc
{
  "kpi": {
    "salesToday": 1234.5, "salesTodayCount": 3,
    "salesMonth": 8900,   "salesMonthCount": 21,
    "purchasesMonth": 4500, "purchasesMonthCount": 7,
    "totalProducts": 42, "lowStockCount": 3,
    "totalCustomers": 15, "totalSuppliers": 8
  },
  "recentSales":     [ /* 10 ventas CONFIRMED/COMPLETED con cliente */ ],
  "recentPurchases": [ /* 10 compras CONFIRMED/RECEIVED con proveedor */ ],
  "lowStock":        [ /* ≤10 productos con totalStock ≤ stockMin */ ],
  "salesByPeriod":   [ { "date": "2026-09-01", "total": 120.5, "count": 2 } ],
  "topProducts":     [ { "sku": "…", "name": "…", "quantity": 9, "revenue": 269.1 } ]
}
```

- Sumas de `sales*`: estados `CONFIRMED|COMPLETED`; `purchasesMonth`:
  `CONFIRMED|RECEIVED`.
- `salesByPeriod`: serie diaria de los **últimos 30 días** (para gráfica).
- `topProducts`: top 5 por unidades vendidas en 30 días (snapshot de venta).

## 10. reports

`GET /reports/<tipo>` (`reports.read`) — JSON; `?format=csv`
(`reports.export`) descarga CSV **y deja auditoría `EXPORT_REPORT`**.

| Ruta | Filtros |
|---|---|
| `/reports/sales` | `dateFrom,dateTo,status,warehouseId,userId,format` |
| `/reports/purchases` | ídem |
| `/reports/inventory` | `warehouseId,format` |
| `/reports/movements` | `dateFrom,dateTo,type,warehouseId,productId,userId,format` |
| `/reports/products` | `status,categoryId,supplierId,format` |
| `/reports/customers` · `/reports/suppliers` | `status,format` |
| `/reports/audit` | `dateFrom,dateTo,action,module,userId,format` |

## 11. audit

`GET /audit` (`audit.read`) — **sólo lectura** (no existe POST/PATCH/DELETE y
el modelo bloquea escrituras). Filtros: `action, module, entity, entityId,
userId, dateFrom, dateTo, page, limit`.

## 12. notifications

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/notifications` `?read&page&limit` | `notifications.read` |
| PATCH | `/notifications/:id/read` | `notifications.update` |

## 13. health

`GET /api/v1/health` → `{ status: "ok", uptime }` (sin auth; usada por
pruebas y supervisión).
