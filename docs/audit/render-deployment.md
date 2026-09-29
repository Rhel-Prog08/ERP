# Informe de preparación de despliegue

## Resumen

Se preparó el monorepo existente para desplegar el backend en Render, publicar
la web estática y generar builds Android mediante EAS. No se reconstruyó el
ERP ni se afirmó que servicios externos estuvieran configurados.

## Hallazgos y cambios

- Render ejecuta el workspace backend con `npm run backend`; Render proporciona
  `PORT` y el servidor lee el valor de `process.env.PORT`.
- El backend usa Mongoose y `MONGO_URI`; no se encontró configuración de MongoDB
  ni secretos backend en el frontend. No hay archivos `.env` reales versionados.
- Atlas/Mongoose soporta URI `mongodb+srv://`. Se requiere un replica set para
  las transacciones.
- Antes, el wrapper transaccional ejecutaba su operación sin sesión cuando el
  servidor no soportaba transacciones. Ahora responde con
  `TRANSACTIONS_UNAVAILABLE` antes de ejecutar la operación.
- El seed incluye datos de demostración; ahora bloquea su ejecución cuando
  `NODE_ENV=production`.
- La app Expo es una pantalla inicial mínima. Aunque React Navigation está en
  dependencias, no hay navegación funcional ni pantallas conectadas todavía.
- La app ahora tiene identidad CodeEvo, perfiles EAS preview (APK) y production
  (AAB), y exige una URL HTTPS pública para builds preview/production.
- `npm run frontend:web` genera el sitio estático en `apps/frontend/dist`.
- Render debe usar `/api/v1/health` como Health Check Path.

## Validaciones locales

- `npm ci`: completado.
- `npm run frontend:web`: completado; se verificó `apps/frontend/dist/index.html`.
- `npx tsc --noEmit`: completado sin errores.
- `npx expo lint`: 0 errores; 5 warnings existentes.
- `npx expo-doctor`: 21/21 verificaciones; dependencias Expo compatibles.
- `GET /`: HTTP 200 con JSON.
- `GET /api/v1/health` sin MongoDB: HTTP 503 y `database: "disconnected"`.
- Ruta desconocida: HTTP 404 con el envelope de error existente.
- Guard de seed en producción y guard de falta de transacciones: comprobados.

## Pruebas pendientes

No hay MongoDB local activo en `127.0.0.1:27017`: por ello `npm test` no pudo
completar las suites integradas y `npm run smoke` no encontró un servidor API
local. No se probaron conexión real a Atlas, despliegue en Render, login remoto,
ni builds alojados por EAS; requieren cuentas y variables privadas del
propietario.

`npm audit --omit=dev` reportó 10 advisories moderados transitivos relacionados
con Expo/`uuid`. No se aplicó `npm audit fix --force`, ya que la propuesta
forzada implica degradar Expo a una versión antigua.

## Configuración operativa

En Render configure `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`,
`REFRESH_TOKEN_SECRET` y `CLIENT_URL`, entre las variables documentadas en
`docs/deployment/render-backend.md`. Use secretos distintos de al menos 32
caracteres. Configure Atlas para permitir la conexión de Render y guarde su URI
solo en Render Environment Variables.

En el Static Site establezca `EXPO_PUBLIC_APP_ENV=production` y
`EXPO_PUBLIC_API_URL=https://TU-BACKEND-RENDER.onrender.com/api/v1`; el
directorio publicable es `apps/frontend/dist`. En EAS configure la URL HTTPS
equivalente para los entornos preview y production. Los builds remotos no se
generaron en esta sesión.

## Documentación complementaria

- `docs/deployment/DEPLOYMENT.md`
- `docs/deployment/render-backend.md`
- `docs/deployment/render-web.md`
- `docs/deployment/mongodb-atlas.md`
- `docs/deployment/eas-android.md`
- `docs/deployment/testing.md`