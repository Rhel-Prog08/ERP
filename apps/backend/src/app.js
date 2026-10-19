'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const { sanitizeInput } = require('./middlewares/sanitize');
const { globalLimiter } = require('./middlewares/rateLimit');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const apiRouter = require('./routes');

// Export web de producción (Expo): si existe dist/index.html, Express sirve la
// app CodeEvo ERP en la raíz. En test/dev sin export, nada cambia (JSON intacto).
const webDist = path.resolve(__dirname, '../../frontend/dist');
const webIndex = path.join(webDist, 'index.html');
const serveWeb = !env.isTest && fs.existsSync(webIndex);

const app = express();

// Confiar en el primer proxy (rate limit + req.ip correctos detrás de reversa).
app.set('trust proxy', 1);

// Headers de seguridad (helmet) y CORS restringido al frontend configurado.
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Sin origin (curl, móvil nativo) → permitido; el token JWT ya autentica.
      if (!origin || env.clientOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));
if (!env.isTest) app.use(morgan('dev'));
app.use(globalLimiter);
app.use(sanitizeInput);

// Raíz: JSON de información de la API (dev/test). Con el export web montado,
// `express.static` resuelve "/" antes y la raíz sirve la app CodeEvo.
if (!serveWeb) {
  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        name: 'CodeEvo ERP API',
        version: 'v1',
        status: 'online',
      },
    });
  });
}

// Salud del servicio (usado por pruebas y supervisión).
app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

app.use('/api/v1', apiRouter);

// Frontend estático (sólo con export presente). Prioridad: API > estáticos >
// fallback SPA > 404 JSON. Los API desconocidos NUNCA reciben HTML.
if (serveWeb) {
  app.use(express.static(webDist, { index: 'index.html', fallthrough: true }));

  // Fallback SPA para rutas de navegación (/login, /productos, ...).
  // Se omite en /api/* (→ 404 JSON) y en archivos con extensión (assets).
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || path.extname(req.path)) return next();
    if (!req.accepts('html')) return next();
    res.sendFile(webIndex);
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
