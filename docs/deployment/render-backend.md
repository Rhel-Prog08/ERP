# Despliegue del backend en Render

## Servicio

El backend existente se despliega como un Render Web Service desde la raíz del repositorio:

- Build Command: `npm ci`
- Start Command: `npm run backend`
- Health Check Path: `/api/v1/health`
- Runtime: Node.js

El blueprint raíz `render.yaml` declara este servicio. Render inyecta `PORT`; el backend lo lee desde `process.env.PORT` y conserva `4000` como fallback local.

## Variables de entorno

Configurar en Render Environment:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Cadena SRV privada de MongoDB Atlas |
| `JWT_SECRET` | Secreto aleatorio de al menos 32 caracteres |
| `REFRESH_TOKEN_SECRET` | Otro secreto aleatorio de al menos 32 caracteres, distinto del anterior |
| `JWT_EXPIRES_IN` | `15m` (o el valor acordado) |
| `REFRESH_TOKEN_EXPIRES_IN` | `7d` (o el valor acordado) |
| `CLIENT_URL` | Origen(es) exactos del frontend, separados por coma si hay más de uno |
| `MAX_LOGIN_ATTEMPTS` | `5` |
| `LOGIN_LOCKOUT_MINUTES` | `15` |

Los secretos deben almacenarse únicamente en Render Environment Variables. No agregue `MONGO_URI` ni secretos a GitHub o al cliente Expo.

## Comprobación

Después del despliegue:

```text
https://TU-SERVICIO.onrender.com/api/v1/health
```

Debe responder HTTP 200 con `database: "connected"`. Render debe usar exactamente `/api/v1/health` como Health Check Path, no `/`.

El proceso de arranque falla si faltan variables requeridas, si los secretos de producción son débiles/iguales o si no hay conexión inicial a MongoDB. Operaciones transaccionales se rechazan si el servidor conectado no admite transacciones.

## Límites

El repositorio no puede comprobar que el servicio remoto esté desplegado: requiere una cuenta Render y valores reales configurados por el propietario. Los servicios gratuitos pueden suspenderse por inactividad y tardar en responder al reactivarse.
