'use strict';

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const { sanitizeInput } = require('./middlewares/sanitize');
const { globalLimiter } = require('./middlewares/rateLimit');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');
const apiRouter = require('./routes');

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

// Salud del servicio (usado por pruebas y supervisión).
app.get('/api/v1/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  res.status(databaseConnected ? 200 : 503).json({
    success: true,
    data: {
      api: 'ok',
      database: databaseConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    },
  });
});

app.use('/api/v1', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
