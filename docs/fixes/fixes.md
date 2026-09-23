# Registro de correcciones — `docs/fixes/`

Correcciones aplicadas durante el desarrollo, con archivo, causa y motivo.
Las correcciones de seguridad/funcionalidad detectadas en la auditoría
previa viven además en `docs/audit/system-audit.md` y se resumen en
`docs/audit/final-report.md`.

---

## FIX-001 · Binario de MongoDB a punto de entrar en git (severidad: alta)

- **Fecha**: fase inicial.
- **Archivo**: `.gitignore`
- **Problema**: el directorio `.mongo/` (portable MongoDB 7.0.28, ~629 MB)
  y los `.zip` de descarga no estaban ignorados; `git status` los listaba
  como `??` y un `git add .` hubiera versionado cientos de MB.
- **Corrección**: añadir `.mongo/` y `*.zip` junto a `.mongo-data/`.
- **Verificado**: `git status --short` ya no muestra `.mongo/`.

## FIX-002 · `.env` apuntando a la BD de pruebas en desarrollo (media)

- **Fecha**: tras ejecutar la suite de pruebas en fase temprana.
- **Archivo**: `apps/backend/.env`
- **Problema**: una ejecución temprana dejó `MONGO_URI` del entorno de
  desarrollo apuntando a `erp_test`; el seed escribía en la BD de pruebas
  y la BD real `erp` quedaba vacía. Además `erp_test` quedó contaminada
  con datos de dev.
- **Corrección**: restaurar `.env` de desarrollo (`erp`) y purgar
  `erp_test` (`dropDatabase`) para que la suite arranque limpia siempre.
- **Verificado**: `GET /api/v1/health` → 200 y `npm run seed` escribe en
  `erp`; la suite (`tests/run.js`) reconecta y limpia `erp_test` por su
  cuenta con `NODE_ENV=test`.

## FIX-003 · `NODE_ENV=… node …` no funciona en Windows PowerShell (media)

- **Fecha**: fase de pruebas.
- **Archivo**: `apps/backend/tests/run.js`
- **Problema**: el prefijo de asignación inline (`NODE_ENV=test node
  tests/…`) es sintaxis POSIX; en Windows/PowerShell el script fallaba y
  las pruebas corrían contra la BD equivocada o sin aislamiento.
- **Corrección**: wrapper `node tests/run.js` que fija
  `process.env.NODE_ENV='test'` y `MONGO_URI=…erp_test…` **antes** de
  relanzar `node --test --test-concurrency=1 tests/`.
  `--test-concurrency=1` (serial) porque los archivos comparten una BD:
  cada `before()` hace `dropDatabase()` y la ejecución paralela rompería
  el aislamiento.
- **Verificado**: `npm test` arranca con el entorno correcto en Windows.

## FIX-004 · Scripts documentados que no existían (media)

- **Fecha**: redacción del README.
- **Archivos**: `package.json` (raíz), `apps/backend/package.json`,
  `scripts/dev.js` (nuevo).
- **Problema**: el README anunciaba `npm run dev` (raíz) y
  `npm run smoke -w apps/backend`, pero ningún `package.json` los
  definía → el lector obtendría `Missing script`.
- **Corrección**:
  - Raíz: `"dev": "node scripts/dev.js"` (arranca backend `--watch` y
    Expo en paralelo, etiquetando la salida, sin dependencias extra;
    Ctrl+C detiene ambos).
  - Raíz: `"smoke": "npm run smoke --workspace=apps/backend"`.
  - Backend: `"smoke": "node scripts/smoke.js"`.
- **Verificado**: `node --check scripts/dev.js` OK y los dos
  `package.json` parsean como JSON válido.

## FIX-005 · Errores de exactitud en la documentación (baja)

- **Fecha**: redacción de `docs/`.
- **Archivos**: `docs/api.md`, `docs/database.md`, `docs/architecture.md`.
- **Problema**: primer borrador con datos no verificados: campo
  `stockValue` que el dashboard no devuelve, nombre de función
  `applyMutation` (real: `applyMovement`), empresa demo "S.A." (real:
  "S.L.").
- **Corrección**: contrastado contra los fuentes
  (`modules/dashboard/service.js`, `modules/inventory/service.js`,
  `database/seed.js`) y corregido.
- **Regla**: toda afirmación de docs debe contrastarse con el código o
  con una ejecución real (regla del proyecto: no fabricar afirmaciones).

---

## Pendientes abiertos por corrección

- FIX-002 deja un apunte: si algún día se cambia `.env` de nuevo a
  `erp_test`, el seed volverá a contaminar la BD de pruebas. Mitigación
  actual: `tests/run.js` siempre purga `erp_test` al inicio.
