# Despliegue Web en Render

## Build y directorio publicable

El frontend es Expo + React Native Web. Desde la raíz:

```powershell
npm ci
npm run frontend:web
```

Expo exporta la web estática a `apps/frontend/dist`. Ese es el `staticPublishPath` declarado en `render.yaml`.

Render Static Site:

- Root Directory: raíz del repositorio
- Build Command: `npm ci && npm run frontend:web`
- Publish Directory: `apps/frontend/dist`
- `EXPO_PUBLIC_APP_ENV=production`
- Environment variable: `EXPO_PUBLIC_API_URL=https://TU-BACKEND-RENDER.onrender.com/api/v1`

La URL se incorpora al bundle público del frontend; no debe contener secretos.

Para iniciar el servidor Expo web interactivo en desarrollo, use `npm run frontend:web:dev` o el comando combinado `npm run dev`.

## CORS

Establezca `CLIENT_URL` en el Web Service del backend con el origen exacto del sitio web de Render, por ejemplo `https://TU-FRONTEND.onrender.com`, sin `*`. Si la interfaz se sirve desde más de un origen, sepárelos con comas. Actualice esta variable después de cambiar el dominio del Static Site.

## Comprobación

Abra la URL pública del Static Site y verifique el acceso al backend y el login. El build web solo comprueba la compilación; no acredita una conexión real con Render o MongoDB Atlas.
