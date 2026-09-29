# MongoDB Atlas

## Configuración

1. Cree un clúster de Atlas y un usuario de base de datos dedicado con los privilegios mínimos necesarios sobre la base del ERP.
2. En Network Access autorice las direcciones de salida del servicio Render. Render puede usar IPs de salida variables; consulte las capacidades del plan y la documentación actual de Render. Para pruebas, cualquier regla amplia de red debe limitarse temporalmente y revisarse antes de producción.
3. Copie la cadena de conexión del driver Node.js, elija la base `erp` y guárdela como `MONGO_URI` en Render Environment Variables.
4. Mantenga las credenciales codificadas correctamente en la URI y no las incluya en frontend, archivos versionados ni logs.

Las cadenas `mongodb+srv://` son compatibles con Mongoose. La conexión ocurre exclusivamente en `apps/backend/src/config/db.js`.

## Transacciones

Atlas proporciona topología compatible con transacciones. El backend comprueba `hello` al conectar. Las operaciones que usan `withTransaction` fallan con un error explícito si el servidor no soporta transacciones; no se ejecutan silenciosamente sin sesión.

Para desarrollo local se necesita MongoDB como replica set, por ejemplo `rs0`, según los comandos de la guía principal. La conexión remota de Atlas no se puede certificar desde este workspace sin credenciales ni acceso de red.

## Aislamiento

El frontend nunca accede directamente a Atlas. El flujo es cliente → Express → Mongoose → Atlas. La autoridad sobre `companyId` permanece en el usuario autenticado del backend.
