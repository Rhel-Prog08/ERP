'use strict';

/**
 * send-test-mail.js — FASE I: prueba de envío REAL aislada (fuera de rutas HTTP).
 *
 * NO toca los flujos de registro/invitación y NO requiere REGISTRATION_ENABLED.
 * Envía UN solo correo de prueba con el mailer actual (proveedores reales).
 *
 * Uso:
 *   MAIL_TEST_ALLOWED_RECIPIENT="tu@correo.com" \
 *   node scripts/send-test-mail.js --to "tu@correo.com"
 *
 * Validaciones PREVIAS (cualquier fallo => exit≠0 y NO se envía nada):
 *   1. Debe existir MAIL_TEST_ALLOWED_RECIPIENT (allowlist en el entorno)
 *      y --to debe coincidir EXACTAMENTE con ella: el destinatario queda
 *      validado de forma explícita, nunca se envía a una dirección libre.
 *   2. Proveedor REAL configurado (resend|smtp con credenciales): jamás el
 *      doble 'test' (eso sería una prueba simulada, no real).
 *   3. NODE_ENV distinto de 'test' (este script no pertenece a la suite).
 *
 * Nunca imprime RESEND_API_KEY ni otras credenciales: sólo proveedor y
 * destinatario enmascarado.
 */

const path = require('node:path');

// Mismo .env que src/config/env.js: dotenv lee desde cwd => apps\backend.
process.chdir(path.resolve(__dirname, '..'));
require('dotenv').config();

const env = require('../src/config/env');
const { sendMail, isMailConfigured } = require('../src/utils/mailer');

/** Igual que mailer.maskRecipient: sólo primera letra + dominio. */
function mask(address) {
  const s = String(address || '');
  const at = s.lastIndexOf('@');
  if (at <= 0) return '****';
  return `${s[0]}***${s.slice(at)}`;
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : '';
}

async function main() {
  const to = argValue('--to');
  const allowed = process.env.MAIL_TEST_ALLOWED_RECIPIENT || '';

  const fails = [];
  if (!to) fails.push('falta --to <direccion>');
  if (!allowed) {
    fails.push('falta MAIL_TEST_ALLOWED_RECIPIENT (allowlist) en el entorno');
  } else if (to !== allowed) {
    fails.push('--to NO coincide exactamente con MAIL_TEST_ALLOWED_RECIPIENT');
  }
  if (env.isTest) fails.push('NODE_ENV=test: esta prueba real no corre en modo test');
  if (env.mail.provider === 'test') fails.push('MAIL_PROVIDER=test: doble de pruebas no válido aquí');
  if (!env.mail.configured || !isMailConfigured()) {
    fails.push('mailConfigured=false (proveedor sin credenciales)');
  }

  if (fails.length > 0) {
    // Sin envío alguno: salida explícita de aborto.
    console.error('[test-mail] ABORTADO (no se envió nada):');
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(2);
  }

  // Resumen no sensible (proveedor + destino enmascarado; jamás la API key).
  console.log(`[test-mail] provider=${env.mail.provider} nodeEnv=${process.env.NODE_ENV || 'development'}`);
  console.log(`[test-mail] destino_validado=${to === allowed ? 'si' : 'no'} destino=${mask(to)}`);

  await sendMail({
    to,
    subject: 'CodeEvo ERP — Prueba técnica de envío (FASE I)',
    text:
      'Esto es una prueba técnica del canal de correo transaccional de CodeEvo ERP.\n' +
      'No requiere ninguna acción. Si la recibes, la integración del proveedor funciona.\n' +
      '— CodeEvo ERP',
    html:
      '<p>Esto es una <strong>prueba técnica</strong> del canal de correo transaccional de CodeEvo ERP.</p>' +
      '<p>No requiere ninguna acción. Si la recibes, la integración del proveedor funciona.</p>' +
      '<p>— CodeEvo ERP</p>',
  });

  console.log('[test-mail] ENVIO_OK (el proveedor aceptó el mensaje)');
  process.exit(0);
}

main().catch((err) => {
  // MailError no contiene credenciales; sólo estado/detalle del proveedor.
  console.error(`[test-mail] ENVIO_FALLIDO: ${err && err.message}`);
  process.exit(1);
});
