# Builds Android con EAS

La configuración mantiene Expo Continuous Native Generation: no se deben crear manualmente `android/` o `ios/`. La identidad de app está en `apps/frontend/app.json`:

- Nombre: `CodeEvo ERP`
- Slug: `codeevo-erp`
- Versión: `1.0.0`
- Android package: `com.codeevo.erp`

## Preparación de EAS

Desde `apps/frontend`:

```powershell
npx eas-cli login
npx eas-cli build:configure
```

Asocie el proyecto con la cuenta Expo del propietario y complete la configuración interactiva. No incluya tokens de Expo en el repositorio.

Configure `EXPO_PUBLIC_API_URL` como variable pública de EAS:

- Environment `preview`: `https://TU-BACKEND-RENDER.onrender.com/api/v1`
- Environment `production`: la URL HTTPS de la API de producción

No use `localhost`, una dirección `127.0.0.1` ni una IP LAN en esos entornos. `apps/frontend/src/services/apiClient.ts` permite el fallback local solamente en desarrollo y falla explícitamente si falta la URL en preview/production.

## Generar builds

```powershell
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

`preview` genera APK instalable para pruebas internas. `production` genera Android App Bundle (AAB) para distribución en Google Play.

Los perfiles se configuran en `apps/frontend/eas.json`. EAS necesita una cuenta y el proyecto asociado para iniciar builds; este repositorio no contiene credenciales ni un `projectId` asignado.
