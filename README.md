# ERP — Sistema Enterprise Resource Planning para PyMEs

ERP multiempresa modular para pequeñas y medianas empresas. Monolito modular
(17+ módulos) con API REST versionada, RBAC granular y trazabilidad completa.

> Proyecto académico (FP). Stack: **React Native / React Native Web · Node.js ·
> Express · MongoDB**. Kotlin queda reservado sólo para futuras funciones
> nativas Android (P2), no usado en el alcance actual.

---

## 1. Requisitos

| Componente | Versión mínima | Notas |
|---|---|---|
| Node.js | 20 LTS (probado con 24) | `node -v` |
| npm | 10+ | en Windows PowerShell usar `npm.cmd` |
| MongoDB | 7+ (local o Atlas) | **debe ser replica set** para transacciones |
| Git | 2.x | sólo para clonar/commitear |

Opcional: Expo Go en un dispositivo móvil para probar el frontend nativo.

---

## 2. Puesta en marcha (desde cero)

```powershell
# 1. Instalar dependencias (monorepo con workspaces)
npm install

# 2. Variables de entorno
Copy-Item apps\backend\.env.example apps\backend\.env   # Linux: cp ...
# Editar apps\backend/.env (ver §3)

# 3. MongoDB local (replSet obligatorio para transacciones)
mongod --dbpath .\.mongo-data --port 27017 --bind_ip 127.0.0.1 --replSet rs0
node apps\backend\scripts\init-replica.js               # una sola vez por arranque

# 4. Sembrar datos iniciales (empresa demo, 6 roles, 56 permisos, admin)
npm.cmd run seed -w apps/backend

# 5. Arrancar API (puerto 4000) + Expo (puerto 8081)
npm.cmd run dev            # raíz: backend (watch) + frontend (expo)
```

- API: <http://localhost:4000/api/v1/health>
- Web: <http://localhost:8081> (React Native Web)
- Móvil: Expo Go → *Scan QR* (misma red LAN).

### Credenciales de desarrollo (SOLO DESARROLLO — nunca en producción)

| Campo | Valor |
|---|---|
| Email | `admin@demo.local` |
| Contraseña | `Admin12345!` |
| Empresa | Distribuciones Demo S.L. |
| Sucursal / Almacén | Sucursal Central / Almacén Central |

> Estas credenciales las crea `npm run seed`. Bórralas (o cambia la contraseña)
> antes de cualquier despliegue real.

---

## 3. Variables de entorno (`apps/backend/.env`)

| Variable | Ejemplo | Descripción |
|---|---|---|
| `NODE_ENV` | `development` | `production` desactiva logs de error detallados |
| `PORT` | `4000` | Puerto del API |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/erp?replicaSet=rs0` | URI de MongoDB (local o Atlas) |
| `JWT_SECRET` | *(fuerte, 32+ bytes)* | Firma del access token |
| `JWT_EXPIRES_IN` | `15m` | Caducidad del access token |
| `REFRESH_TOKEN_SECRET` | *(fuerte, distinto del anterior)* | Firma del refresh token |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` | Caducidad del refresh token |
| `CLIENT_URL` | `http://localhost:8081` | Origen permitido por CORS |

**.env nunca se sube a git** (está en `.gitignore`). `.env.example` documenta
la plantilla sin secretos.

---

## 4. MongoDB Atlas (producción / nube)

1. Crear clúster gratuito en <https://www.mongodb.com/atlas>.
2. *Database Access*: usuario con `readWrite` a la base `erp`.
3. *Network Access*: añadir la IP del servidor (o `0.0.0.0/0` sólo para pruebas).
4. *Connect → Drivers*: copiar la URI y **añadir el parámetro de replica set**:

```
mongodb+srv://usuario:clave@cluster0.xxxxx.mongodb.net/erp?retryWrites=true&w=majority
```

> Atlas es replica set gestionado: las transacciones funcionan sin `init-replica`.
> Si tu URI trae `replicaSet=...`, respétalo. Recuerda: las credenciales van
> **sólo** en `.env`, nunca en el código ni en git.

5. Configurar `MONGO_URI` en el `.env` del entorno de despliegue y ejecutar
   `npm run seed -w apps/backend` una vez.

---

## 5. Estructura del proyecto

```
Proyecto FP/
├── apps/
│   ├── backend/          # API Express (monolito modular)
│   │   ├── src/
│   │   │   ├── config/   # env, conexión Mongo, constantes RBAC
│   │   │   ├── database/ # seed + secuencias (CL-, PR-…)
│   │   │   ├── middlewares/ # auth JWT, RBAC, errores, rate-limit
│   │   │   ├── modules/  # 19 módulos (auth…notifications)
│   │   │   ├── utils/    # validador, CRUD factory, errores, CSV
│   │   │   └── app.js
│   │   ├── tests/        # node:test + supertest (npm test)
│   │   └── scripts/      # smoke, init-replica
│   └── frontend/         # React Native (Expo) + React Native Web
│       └── src/
│           ├── components/  screens/  navigation/
│           ├── services/    stores/   hooks/
│           └── utils/       constants/  types/
├── docs/                 # arquitectura, API, base de datos, guías
└── package.json          # workspaces + scripts raíz
```

---

## 6. API — resumen

- Prefijo: **`/api/v1`**
- Envelope: `{ "success": true, "data": … }` /
  `{ "success": false, "error": { "code", "message" } }`
- Auth: `Authorization: Bearer <accessToken>` (JWT 15 min) + refresh token
  rotativo (7 días, hash SHA-256 en servidor).
- Errores tipados: `VALIDATION_ERROR (400)`, `AUTHENTICATION_ERROR (401)`,
  `AUTHORIZATION_ERROR (403)`, `NOT_FOUND (404)`, `CONFLICT (409)`,
  `INTERNAL_ERROR (500)`.

Módulos: `auth, users, roles, permissions, companies, branches, warehouses,
customers, suppliers, categories, products, inventory, sales, purchases,
dashboard, reports, audit, settings, notifications`.

Detalle completo en **[docs/api.md](docs/api.md)**.

---

## 7. Tests

```powershell
npm.cmd test -w apps/backend     # suite integrada (node:test + supertest)
npm.cmd run smoke -w apps/backend  # 13 comprobaciones contra el servidor vivo
```

La suite cubre: autenticación (token válido/inválido/expirado, bloqueo),
RBAC (autorizado/no autorizado), productos (SKU duplicado), inventario
(entrada/salida/insuficiente/ajuste), compras, ventas, **multiempresa
(empresa A → empresa B denegado)**, auditoría y escenario E2E de 18 pasos.
Ver [docs/deployment/testing.md](docs/deployment/testing.md).

---

## 8. Pendientes y futuras mejoras

- **P2 (no alcance actual):** Kotlin nativo (biometría, NFC, Bluetooth,
  impresión de tickets), notificaciones push, OAuth2/SSO.
- Filtros avanzados y paginación cursor en algunos listados.
- i18n (ES/EN) y modo oscuro en frontend.

---

## 9. Documentación

| Documento | Contenido |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Diagramas, patrones, decisiones |
| [docs/api.md](docs/api.md) | Endpoints, payloads, códigos de error |
| [docs/database.md](docs/database.md) | Modelos, índices, transacciones |
| [docs/security.md](docs/security.md) | AuthN/Z, multiempresa, durabilidad |
| [docs/testing.md](docs/testing.md) | Cómo ejecutar y cubrir pruebas |
| [docs/user-guide.md](docs/user-guide.md) | Guía de uso por módulo |
| [docs/audit/](docs/audit/) | Auditoría inicial y reporte final |
| [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) | Despliegue en Render, Atlas, Web y EAS |
