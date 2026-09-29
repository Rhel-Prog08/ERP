# Checklist de pruebas de despliegue

## Comprobaciones locales

Desde la raíz:

```powershell
npm test
npm run smoke
npm run frontend:build
```

Desde `apps/frontend`:

```powershell
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

Las pruebas integradas del backend necesitan MongoDB local con replica set y `MONGO_URI` accesible. Smoke test requiere API activa y datos preparados. Los resultados de ejecución de este workspace se consignan en `DEPLOYMENT.md` o en el reporte de entrega, sin afirmar disponibilidad de servicios remotos que no se hayan probado.

## Backend y Atlas

- `GET /api/v1/health` devuelve HTTP 200 y `database: "connected"` cuando Mongo está disponible.
- Compruebe el login con credenciales de prueba no productivas.
- Pruebe una escritura y una lectura mediante la API, con un usuario de prueba.
- Ejecute los casos existentes de autenticación, permisos, multiempresa, productos, inventario, ventas, compras y E2E.
- Confirme que la identidad de otra empresa no puede leer ni modificar datos ajenos.
- Confirme que el seed se rechaza con `NODE_ENV=production`.
- Confirme que las operaciones transaccionales no continúan si el deployment no soporta transacciones.

## Frontend Web y APK

- Web: abrir la URL de Render, iniciar sesión y confirmar el acceso a la API HTTPS.
- Preview APK: instalar en un dispositivo Android externo a la LAN de desarrollo.
- Confirmar que `EXPO_PUBLIC_API_URL` apunta al backend HTTPS, sin localhost ni IP local.
- Probar login correcto/incorrecto, logout y refresh; dashboard; productos; entrada/salida/ajuste de inventario; ventas; compras y auditoría.
- No declarar pruebas reales de negocio completadas solo por compilar el bundle o generar el APK.

## Seguridad

- Verificar que secretos solo existen en variables de entorno privadas del backend.
- Confirmar que el bundle del frontend no contiene URI ni secretos del backend.
- Revisar los orígenes exactos de `CLIENT_URL` y evitar CORS `*`.
- Usar cuentas/datos de prueba y retirar permisos temporales de Atlas al finalizar.
