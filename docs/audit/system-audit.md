# Auditoría del Sistema ERP — `docs/audit/system-audit.md`

**Fecha de auditoría:** 2026-09-23
**Auditor:** Agente de ingeniería (Arquitecto de Software Senior / Full Stack / Seguridad / QA)
**Alcance:** workspace completo `C:\Users\Adry RoMa\Desktop\Proyecto FP`

---

## A. Estado general

### Hallazgo principal (CRÍTICO)

> **El workspace está completamente vacío. No existe ningún proyecto ERP.**

Verificación realizada:

- Listado del directorio raíz (incluyendo archivos ocultos): **0 entradas**.
- Búsqueda recursiva de archivos (`**/*`): **0 archivos**.
- Búsqueda de `package.json`, `.env*`, `docs/**/*`: **sin resultados**.
- No hay repositorio Git inicializado.

**Conclusión:** la sesión anterior del proyecto terminó únicamente con la instalación de
herramientas (Node.js LTS y Git). **No se escribió una sola línea del ERP.**

### Qué existe

| Elemento | Estado |
|---|---|
| Código fuente (backend/frontend) | No existe |
| `package.json` / dependencias | No existe |
| Modelos MongoDB | No existe |
| Rutas / controllers / services | No existe |
| Autenticación | No existe |
| Frontend (screens, components) | No existe |
| `.env` / `.env.example` | No existe |
| Documentación | Solo este informe de auditoría |

### Qué está funcionando

Ninguna parte del sistema: no hay sistema que ejecutar.

### Qué tiene errores

No aplica (no hay código que contenga errores de compilación o ejecución).

### Qué falta implementar

**Todo el alcance P0 y P1:**

- P0: autenticación, usuarios, roles, permisos, empresas, sucursales, almacenes,
  clientes, proveedores, categorías, productos, inventario, compras, ventas, auditoría.
- P1: dashboard, reportes, filtros, exportación.
- Frontend React Native + React Native Web completo.

---

## B. Frontend

| Ítem | Resultado |
|---|---|
| Navegación | No existe |
| Screens | No existen |
| Componentes reutilizables | No existen |
| Formularios | No existen |
| Manejo de errores / estados | No existe |
| Llamadas API centralizadas | No existe |
| Responsive / React Native Web | No existe |
| Compatibilidad móvil | No existe |

## C. Backend

| Ítem | Resultado |
|---|---|
| Express / app server | No existe |
| Rutas `/api/v1` | No existen |
| Controllers / services | No existen |
| Middlewares (auth, RBAC, errores) | No existen |
| Validaciones | No existen |
| Manejo centralizado de errores | No existe |
| Autenticación JWT / refresh | No existe |
| Autorización RBAC | No existe |

## D. MongoDB

| Ítem | Resultado |
|---|---|
| Conexión backend → Atlas | No existe |
| Modelos / colecciones | No existen |
| Referencias e índices | No existen |
| Aislamiento `companyId` | No existe |
| Servidor local (entorno) | MongoDB 8.3.11 instalado, **servicio detenido**, sin data dir, puerto 27017 cerrado → se arrancará localmente para pruebas |

## E. Seguridad

| Ítem | Resultado |
|---|---|
| Hash de contraseñas | No existe |
| JWT / refresh tokens | No existen |
| RBAC backend | No existe |
| CORS / rate limiting / helmet | No existe |
| `.env` y `.env.example` | No existen |
| Protección NoSQL injection | No existe |
| Aislamiento entre empresas | No existe |
| Auditoría (auditLogs) | No existe |
| Credenciales hardcodeadas | No aplica (no hay código) |

## F. Calidad

| Ítem | Resultado |
|---|---|
| Código duplicado | No aplica |
| Archivos gigantes | No aplica |
| Dependencias innecesarias | No aplica (no hay `package.json`) |
| Errores de compilación/ejecución | No aplica |
| Problemas de arquitectura | No aplica |

---

## Clasificación de problemas detectados

| # | Severidad | Problema |
|---|---|---|
| 1 | **CRÍTICO** | No existe el sistema: el workspace está vacío. Todo el ERP debe construirse. |
| 2 | **MEDIO** | Servicio MongoDB local detenido y sin directorio de datos; las pruebas no podrán ejecutarse hasta arrancarlo. |
| 3 | **BAJO** | `npm` no funciona directamente en PowerShell por política de ejecución (`npm.ps1` bloqueado); usar `npm.cmd` o fijar `ExecutionPolicy Process Bypass`. |
| 4 | **BAJO** | `mongosh` no instalado (no bloquea; las pruebas usarán la driver de Node). |

---

## Plan de corrección derivado

Al no existir código previo, el "orden de corrección" de la sección 8 del instructivo
se traduce en construir directamente respetando ese orden (compilación → ejecución →
configuración → conexión → backend → seguridad → auth → RBAC → modelos → CRUD →
inventario → compras → ventas → auditoría → dashboard → reportes → UX → pruebas →
documentación), dejando trazabilidad de cada corrección en `docs/fixes/`.

**Decisión registrada (regla 47 — no inventar requisitos):** se construye el proyecto
desde la estructura base porque no hay trabajo existente que preservar; no se elimina,
sobrescribe ni reescribe ningún archivo del usuario.
