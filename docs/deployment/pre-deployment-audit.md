# Auditoría pre-despliegue ERP

## GitHub

- Repositorio detectado: `Rhel-Prog08/ERP`
- Branch actual: `master` (el workspace local usa la rama `agents/pasted-text-processing`, derivada de `master`)
- Estructura observada:
  - `apps/backend/`: API Express + Mongoose + módulos ERP
  - `apps/frontend/`: Expo + React Native + React Native Web
  - `docs/`: arquitectura, API, seguridad, usuario, auditoría
  - `scripts/`: launcher de desarrollo paralelo
  - `package.json`: workspaces raíz con `apps/*`
  - `package-lock.json`: lockfile generado por npm
- Package manager: npm
- Workspaces: `apps/*` y `packages/*` (aunque actualmente solo existe `apps/` con trabajo real)
- Scripts raíz:
  - `backend`: `npm run start --workspace=apps/backend`
  - `backend:dev`: `npm run dev --workspace=apps/backend`
  - `dev`: `node scripts/dev.js`
  - `frontend`: `npm run start --workspace=apps/frontend`
  - `frontend:web`: `npm run web --workspace=apps/frontend`
  - `seed`: `npm run seed --workspace=apps/backend`
  - `smoke`: `npm run smoke --workspace=apps/backend`
  - `test`: `npm run test --workspace=apps/backend`
  - `test:backend`: `npm run test --workspace=apps/backend`
- Archivos de configuración principales:
  - `package.json`
  - `package-lock.json`
  - `.gitignore`
  - `.env.example`
  - `apps/backend/package.json`
  - `apps/backend/.env.example`
  - `apps/frontend/package.json`
  - `apps/frontend/app.json`
  - `apps/frontend/tsconfig.json`

## Backend

- Node requerido: el manifiesto raíz declara `>=18`; el README recomienda Node 20 LTS. Validado localmente con Node 24.19.0. Para desplegar, usar una versión LTS soportada por Render y las dependencias.
- Express: `express` 4.21.2 en `apps/backend/package.json`
- Mongoose: `mongoose` 8.9.5 en `apps/backend/package.json`
- Endpoints principales:
  - `GET /api/v1/health` en `apps/backend/src/app.js`
  - Routers montados bajo `app.use('/api/v1', apiRouter)` desde `apps/backend/src/routes/index.js`
  - Módulos registrados: `auth`, `users`, `roles`, `permissions`, `companies`, `branches`, `warehouses`, `customers`, `suppliers`, `categories`, `products`, `inventory`, `sales`, `purchases`, `dashboard`, `reports`, `audit`, `settings`, `notifications`
- Health check: `GET /api/v1/health` devuelve `{ success: true, data: { status: 'ok', uptime: ... } }`
- Variables requeridas por backend:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `REFRESH_TOKEN_SECRET`
  - `PORT` (opcional, fallback 4000)
  - `JWT_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` (opcionales con defaults)
  - `CLIENT_URL` (requerida en producción)
  - `NODE_ENV`
  - `MAX_LOGIN_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES`
- Configuración para Render:
  - El servicio se ejecuta desde la raíz con npm workspaces.
  - Comando de arranque: `npm run backend`; Render proporciona `PORT`, y la aplicación lo lee desde `process.env.PORT` con fallback `4000` solo si no se especifica.
  - Variables de producción: `NODE_ENV`, `MONGO_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `CLIENT_URL` y ajustes de expiración/bloqueo opcionales.
  - `render.yaml` declara el Web Service, el health check `/api/v1/health` y el Static Site web.
- Seed: ahora rechaza el entorno `production` antes de conectarse a la base de datos.
- Transacciones: el wrapper compartido ahora falla explícitamente si no se detectó soporte para transacciones; no ejecuta la operación sin sesión.

## Frontend

- Expo: `expo` ~57.0.26 en `apps/frontend/package.json` (actualizado al parche requerido por Expo Doctor)
- React Native: `react-native` 0.86.3
- React Native Web: `react-native-web` ^0.21.2
- Navegación: `App.tsx` actualmente es una pantalla mínima. El manifiesto incluye `@react-navigation/native` y `@react-navigation/native-stack`, pero no hay `NavigationContainer` o stack usado por la app. No se migró ni se implementó navegación.
- Configuración Android: `apps/frontend/app.json` define `android.package=com.codeevo.erp`, iconos adaptativos y `predictiveBackGestureEnabled`.
- Configuración Web: Expo Web está habilitada por script `npm run web` y la app se puede visualizar con React Native Web.
- Variables `EXPO_PUBLIC_*` observadas:
  - `apps/frontend/src/services/apiClient.ts` usa `EXPO_PUBLIC_API_URL`; localhost es fallback solo para desarrollo y los entornos preview/production fallan explícitamente si no configuran una URL.
  - `apps/frontend/.env.example` documenta la URL local. En EAS/Render la URL de producción debe ser HTTPS.

## MongoDB

- La configuración se hace a través de `MONGO_URI` en `apps/backend/src/config/env.js`.
- El backend usa `mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })` en `apps/backend/src/config/db.js`.
- `mongodb+srv://` es compatible con MongoDB Atlas y Mongoose, por lo que el proyecto puede usar cadenas Atlas estándar.
- El código implementa soporte para transacciones mediante `mongoose.startSession()` y `session.withTransaction(...)` cuando el servidor lo admite.
- La base de datos local del proyecto usa `replicaSet=rs0` en los ejemplos para permitir transacciones locales; por tanto, la configuración local exige un replica set.
- El aislamiento por empresa se implementa en la lógica del negocio mediante `companyId` a nivel de usuarios y documentos. Esto queda reflejado en modelos y secuencias (`companyId` en `apps/backend/src/database/sequence.js`) y en la autenticación JWT (`companyId` en `apps/backend/src/middlewares/authenticate.js`).

## EAS

Se comprobó la presencia de:

- `eas.json`: sí existe en `apps/frontend/eas.json`, con perfil `preview` (APK) y `production` (AAB)
- `app.json`: sí existe en `apps/frontend/app.json`
- `app.config.js`: no existe
- `app.config.ts`: no existe

Conclusión: el proyecto tiene perfiles EAS configurados. Debe asociarse a un proyecto/cuenta Expo y definir `EXPO_PUBLIC_API_URL` en los entornos EAS `preview` y `production`.

## Seguridad

Se han revisado los archivos de entorno y la configuración:

- No hay archivos `.env` de entorno versionados; sí se versionan deliberadamente las plantillas `.env.example`.
- `.gitignore` excluye `.env`, `.env.*` y excepciona `.env.example`.
- No se encontraron secretos reales en código fuente ni archivos committed.
- Las cadenas de ejemplo (`JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `MONGO_URI`) están en archivos de ejemplo (`.env.example`, `apps/backend/.env.example`) y son plantillas, no credenciales reales.
- El proyecto ya evita hardcodear credenciales del entorno en el código y usa `dotenv` para cargarlas desde variables de entorno.
- Se recomienda reforzar la política de despliegue: no compartir `MONGO_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET` ni tokens en logs, issues o documentación pública.
- `npm audit --omit=dev` reporta 10 advisories moderados transitivos en dependencias relacionadas con Expo/`uuid`; no se forzó una actualización que degradaría la versión de Expo. Deben evaluarse antes de una entrega de producción.

## Conclusión general

La auditoría confirma la arquitectura Node.js/Express/Mongoose + Expo/React Native Web. El backend y frontend están configurados para Render y EAS; faltan credenciales/servicios reales, configuración de Atlas y pruebas integrales en el entorno remoto. El export web se publica desde `apps/frontend/dist`. Esta auditoría describe la inspección inicial y los cambios de preparación; no afirma que Render, Atlas o EAS estén operativos.
