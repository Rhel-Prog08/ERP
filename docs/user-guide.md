# Guía de usuario — ERP PyMEs

Interfaz en español, multiempresa y responsiva (escritorio, tableta y móvil
vía React Native Web). Todas las acciones están condicionadas al **rol y los
permisos**: si un botón no aparece, tu rol no tiene ese permiso
(consulta a un Administrador).

## 1. Acceso

1. Abre la app (web: `http://localhost:8081`; móvil: Expo Go con el QR).
2. Introduce email y contraseña → **Iniciar sesión**.
3. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos (se avisa).
4. La sesión dura ~15 min de acceso; el refresh es automático. **Cerrar
   sesión** revoca el refresh en el servidor.

Credenciales de demostración (SOLO DESARROLLO): `admin@demo.local` /
`Admin12345!`.

## 2. Navegación

- **Sidebar** (≥1024 px), **colapsada** (768–1023 px) o **menú hamburguesa**
  (<768 px) con las secciones permitidas por tus permisos.
- **Cabecera**: campana de notificaciones (stock bajo), usuario y logout.

## 3. Panel (Dashboard)

Indicadores reales del mes y del día: ventas, compras, productos, clientes,
proveedores, roturas de stock; últimas ventas/compras, top 5 productos
(30 días) y gráfica de ventas diarias (30 días).

## 4. Maestros (Clientes, Proveedores, Categorías, Productos)

- **Lista**: búsqueda, filtros (estado, categoría…), paginación, orden.
- **Crear**: botón «Nuevo…» → modal con campos validados.
- **Editar**: lápiz en la fila → modal precargado.
- **Desactivar**: papelera + confirmación (es baja lógica: sigue en
  histórico; no se borra nada físico).
- **Productos**: SKU único por empresa (si se repite, el formulario muestra
  el conflicto 409). Una categoría no se desactiva si hay productos
  activos usándola.

## 5. Inventario

- **Balances**: existencia por producto y almacén; filtro «bajo stock»;
  orden por cantidad.
- **Movimientos**: histórico completo (entrada/salida/ajuste/devolución)
  con cantidad anterior/nueva, referencia, usuario y motivo.
- **Nuevo movimiento**: según permiso (`inventory.entry/exit/adjust`):
  - *Entrada*: suma existencia.
  - *Salida*: no permite bajar de cero (409 «Stock insuficiente»).
  - *Ajuste*: fija la existencia a la cantidad indicada (queda el por qué).

## 6. Ventas

1. **Nueva venta**: eliges cliente, almacén y líneas (producto, cantidad,
   precio). El IVA y el total se calculan con la configuración de la
   empresa. Estado: **BORRADOR**.
2. **Confirmar**: descuenta stock y deja movimiento (si no hay stock,
   error y sigue en borrador). Estado: **CONFIRMADO**.
3. **Completar**: cierre de negocio. Estado: **COMPLETADO**.
4. **Cancelar** (con motivo obligatorio): si ya estaba confirmada, el stock
   se **devuelve** automáticamente. Estado: **CANCELADO**.

Filtros por estado, cliente, almacén y fechas.

## 7. Compras

Mismo flujo que ventas con proveedor: BORRADOR → CONFIRMADO → **RECIBIDO**
(al recibir: stock suma, precio de compra del producto se actualiza) o
CANCELADO (con motivo; si estaba recibida, el stock se revierte).

## 8. Reportes

Ocho reportes (ventas, compras, inventario, movimientos, productos,
clientes, proveedores, auditoría) con filtros de fechas/estado/tipos y
**Exportar CSV** (la exportación queda registrada en la auditoría).

## 9. Auditoría

Tabla de solo lectura: quién, qué, cuándo, desde qué IP. Filtros por
acción, módulo, usuario y fechas. El detalle muestra los valores anterior y
nuevo. **Nadie puede editar ni borrar la bitácora.**

## 10. Usuarios y Roles (Administrador)

- **Usuarios**: alta con rol, edición, desactivación (no puedes
  desactivarte a ti mismo). El email es único.
- **Roles**: crea roles y márcales permisos agrupados por módulo. Los 6
  roles de sistema no se borran; **no puedes editar los permisos del rol
  que estás usando**; roles en uso no se eliminan.

## 11. Ajustes

- **Configuración**: tipo de IVA (`taxRate`) y permitir stock negativo.
- **Cambiar contraseña**: requiere la actual; al hacerlo cierra las demás
  sesiones.
- **Empresa/Sucursal/Almacén**: datos fiscales y organización.

## 12. Notificaciones

Actualmente avisos de **stock bajo** (campana de la cabecera). «Marcar como
leída» las archiva.

## 13. Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| «Sesión expirada» | Access token caducado; el refresh automático falló → vuelve a entrar |
| «Permiso requerido: x.y» | Tu rol no tiene ese permiso (o la UI no lo ocultó a tiempo) |
| 404 en un recurso que ves | Suele ser de **otra empresa** (aislamiento multiempresa) |
| «Stock insuficiente» | Al confirmar/retirar no hay existencia en ese almacén |
| «El SKU ya existe» | SKU repetido en tu empresa; cambia uno |
| «Los roles del sistema no se pueden eliminar» | Edita permisos o usa desactivación de usuarios |
| «Demasiadas peticiones» | Rate limit: espera unos minutos (o 15 en login) |
