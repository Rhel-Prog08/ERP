# Guía de despliegue CodeEvo ERP

## Estado y arquitectura

```text
React Native Web / Android APK
             │ HTTPS
             ▼
       Render Web Service
       Node.js + Express
             │ Mongoose
             ▼
         MongoDB Atlas
```

El backend es la única capa que conoce `MONGO_URI`. Los clientes solo conocen la URL HTTPS de la API.

## 1. GitHub

El repositorio oficial es `Rhel-Prog08/ERP`. Instale desde el lockfile:

```powershell
npm ci
```

No suba `.env`, tokens, URI de Atlas ni secretos. El proyecto mantiene npm workspaces y `package-lock.json`.

## 2. MongoDB Atlas

Siga [mongodb-atlas.md](./mongodb-atlas.md). Copie la cadena `mongodb+srv://` a `MONGO_URI` en Render, nunca al frontend. Autorice la conectividad de Render en Atlas y use un usuario dedicado.

## 3. Render Backend

Use el Web Service declarado en `render.yaml` o cree uno manualmente:

- Root Directory: `.`
- Build Command: `npm ci`
- Start Command: `npm run backend`
- Health Check Path: `/api/v1/health`

Detalles: [render-backend.md](./render-backend.md).

## 4. Variables de entorno

En el Web Service configure `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `CLIENT_URL`, `MAX_LOGIN_ATTEMPTS` y `LOGIN_LOCKOUT_MINUTES`. Use dos secretos aleatorios distintos de al menos 32 caracteres. Render inyecta `PORT`; no es necesario fijarlo manualmente.

`CLIENT_URL` debe contener el origen web exacto de Render. No use `*`. No configure los secretos del backend en el Static Site o EAS.

## 5. Render Web

El export web de producción es:

```powershell
npm run frontend:web
```

La salida comprobable del export Expo es `apps/frontend/dist`. Configure el Static Site para publicarla e inyecte `EXPO_PUBLIC_API_URL` con la URL HTTPS de la API. Ver [render-web.md](./render-web.md).

## 6. Expo/EAS y 7. APK

Identidad Android: `CodeEvo ERP`, slug `codeevo-erp`, versión `1.0.0`, package `com.codeevo.erp`. Vincule una cuenta/proyecto EAS y configure la URL de API por separado en los entornos `preview` y `production`.

- `preview`: APK interna instalable.
- `production`: AAB para Play Store.

Instrucciones completas: [eas-android.md](./eas-android.md). No se ha generado un build firmado en este repositorio porque requiere una cuenta EAS.

## 8. Pruebas

Consulte [testing.md](./testing.md). Las pruebas backend necesitan MongoDB replica set disponible; las pruebas web no sustituyen una prueba de conexión real a Render/Atlas ni la aceptación de negocio.

## Problemas frecuentes

- **Falla el health check:** configure Render Health Check Path como `/api/v1/health`; revise `MONGO_URI` y logs del proceso.
- **Transacciones no disponibles:** use MongoDB Atlas o un replica set; las operaciones transaccionales se rechazan sin modificar datos.
- **CORS:** `CLIENT_URL` debe coincidir exactamente con el origen web (incluido `https://`).
- **APK apunta a localhost:** defina `EXPO_PUBLIC_API_URL` en EAS Environment `preview` o `production` y vuelva a construir.
- **Seed rechazado:** el seed de datos demo se bloquea deliberadamente cuando `NODE_ENV=production`.
- **Web no carga:** verifique el publish directory `apps/frontend/dist` y la URL de API pública configurada al compilar.

## Pendientes operativos

Crear el servicio real de Atlas, Render Static Site/Web Service, configurar dominios y variables privadas, vincular el proyecto EAS y realizar pruebas con usuarios. No se afirma que estos servicios remotos estén conectados o desplegados hasta completar esos pasos.

## Validación en este workspace

- `npm run frontend:web`: export web completado con un host de prueba reservado (`example.invalid`); Expo confirmó salida en `apps/frontend/dist`.
- `npx tsc --noEmit`: TypeScript completado sin errores.
- `npx expo lint`: 0 errores y 5 warnings de lint.
- `npx expo-doctor` y `npx expo install --check`: 21/21 verificaciones y dependencias compatibles.
- `GET /`: HTTP 200 con JSON; ruta inexistente: HTTP 404 con el envelope estándar.
- `GET /api/v1/health`: probado sin base disponible, HTTP 503 con `database: "disconnected"`. La respuesta 200 conectada requiere MongoDB replica set, no disponible localmente.
- Guard de transacción sin soporte y rechazo del seed en producción: comprobados.
- `npm test`: bloqueado porque no hay MongoDB escuchando en `127.0.0.1:27017`; las suites se cancelaron al fallar `setup`.
- `npm run smoke`: bloqueado porque no había API local iniciada (`fetch failed`).
- `npm ci`: completado desde el lockfile. `npm audit --omit=dev` reportó 10 advisories moderados transitivos en la cadena de herramientas Expo/`uuid`; no se aplicó `--force` porque npm propone bajar Expo a una versión mayor antigua. Requiere evaluación y actualización compatible antes de una entrega de producción.
- Render, Atlas, login real, EAS remoto y APK: no verificados; necesitan los servicios/cuentas y variables privadas del propietario.
