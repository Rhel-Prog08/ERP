'use strict';

/**
 * Envío de correos transaccionales (verificación de correo, invitaciones).
 *
 * Proveedores REALES (configurados mediante variables de entorno privadas):
 *  - 'resend': API REST de Resend (RESEND_API_KEY) vía fetch.
 *  - 'smtp':   servidor SMTP arbitrario vía nodemailer (SMTP_*).
 * Doble de pruebas (SÓLO NODE_ENV=test + MAIL_PROVIDER=test):
 *  - 'test':   NO envía nada; conserva el mensaje en memoria para que los
 *              tests puedan extraer el enlace. Nunca existe fuera de pruebas.
 * 'none' (por defecto): sin proveedor; enviar lanza MailError. El flujo queda
 * PREPARADO pero inerte hasta configurar un proveedor real.
 *
 * NUNCA imprime tokens, enlaces ni credenciales en logs: sólo éxitos/errores
 * con identificadores no sensibles (destinatario enmascarado, estado HTTP).
 */

const env = require('../config/env');

const { MailError } = require('./errors');

/* ------------------------------------------------------------------ *
 * Doble de pruebas: buzón en memoria (existe únicamente en isTest).   *
 * ------------------------------------------------------------------ */
const testOutbox = [];

function maskRecipient(address) {
  const s = String(address || '');
  const at = s.lastIndexOf('@');
  if (at <= 0) return '****';
  return `${s[0]}***${s.slice(at)}`;
}

/** ¿Hay un proveedor de correo real o el doble de pruebas activo? */
function isMailConfigured() {
  return Boolean(env.mail.configured);
}

/* ------------------------------------------------------------------ *
 * Plantillas (texto + HTML sencillo; sin scripts inline: CSP Helmet).  *
 * ------------------------------------------------------------------ */

function verificationEmail({ to, firstName, token, ttlMinutes }) {
  const link = `${env.appUrl}/verificar?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'CodeEvo ERP — Verifica tu correo electrónico',
    text:
      `Hola ${firstName || ''}:\n\n` +
      `Para activar tu cuenta en CodeEvo ERP, abre este enlace (caduca en ${ttlMinutes} minutos):\n` +
      `${link}\n\n` +
      `Usa SÓLO el enlace de ESTE mensaje: cada reenvío deja sin efecto los anteriores.\n\n` +
      `Si tú no solicitaste esta cuenta, ignora este mensaje.\n` +
      `— CodeEvo ERP`,
    html:
      `<p>Hola ${firstName || ''}:</p>` +
      `<p>Para activar tu cuenta en CodeEvo ERP, pulsa el botón (caduca en ${ttlMinutes} minutos):</p>` +
      `<p><a href="${link}">Verificar mi correo</a></p>` +
      `<p>Usa sólo el enlace de <strong>este</strong> mensaje: cada reenvío deja sin efecto los anteriores.</p>` +
      `<p>Si tú no solicitaste esta cuenta, ignora este mensaje.</p>` +
      `<p>— CodeEvo ERP</p>`,
  };
}

function invitationEmail({ to, firstName, token, inviterName }) {
  const link = `${env.appUrl}/registro?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'CodeEvo ERP — Te han invitado a crear tu cuenta',
    text:
      `Hola ${firstName || ''}:\n\n` +
      `${inviterName || 'Un administrador'} te ha invitado a crear tu cuenta en CodeEvo ERP.\n` +
      `Abre este enlace para completar el registro:\n` +
      `${link}\n\n` +
      `— CodeEvo ERP`,
    html:
      `<p>Hola ${firstName || ''}:</p>` +
      `<p>${inviterName || 'Un administrador'} te ha invitado a crear tu cuenta en CodeEvo ERP.</p>` +
      `<p><a href="${link}">Completar mi registro</a></p>` +
      `<p>— CodeEvo ERP</p>`,
  };
}

/* ------------------------------------------------------------------ *
 * Proveedores reales                                                  *
 * ------------------------------------------------------------------ */

async function sendViaResend(message) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.mail.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.mail.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });
  if (!res.ok) {
    // Sólo estado HTTP: sin cuerpo (puede contener datos del destinatario).
    throw new MailError(`Resend devolvió HTTP ${res.status}`);
  }
  return { provider: 'resend' };
}

async function sendViaSmtp(message) {
  // Importación perezosa: nodemailer sólo se carga si hay SMTP configurado.
  const nodemailer = require('nodemailer');
  const transport = nodemailer.createTransport({
    host: env.mail.smtp.host,
    port: env.mail.smtp.port,
    secure: env.mail.smtp.secure,
    auth: { user: env.mail.smtp.user, pass: env.mail.smtp.pass },
  });
  await transport.sendMail({
    from: env.mail.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return { provider: 'smtp' };
}

function sendViaTestDouble(message) {
  if (!env.isTest) {
    // Red de seguridad: el doble jamás opera fuera de NODE_ENV=test.
    throw new MailError('Doble de pruebas de correo fuera de NODE_ENV=test');
  }
  testOutbox.push({ ...message, sentAt: new Date() });
  return { provider: 'test' };
}

/**
 * Envía un mensaje. Lanza MailError si no hay proveedor o el envío falla.
 * El llamador decide si el error es fatal (registro) o se reintenta.
 */
async function sendMail(message) {
  if (!message || !message.to || !message.subject) {
    throw new MailError('Mensaje de correo incompleto');
  }
  if (env.mail.provider === 'test') return sendViaTestDouble(message);
  if (!env.mail.configured) throw new MailError('Proveedor de correo no configurado');
  if (env.mail.provider === 'resend') return sendViaResend(message);
  if (env.mail.provider === 'smtp') return sendViaSmtp(message);
  throw new MailError(`Proveedor de correo desconocido: ${env.mail.provider}`);
}

/** Atajos de plantilla con envío. */
async function sendVerificationMail({ to, firstName, token, ttlMinutes }) {
  const message = verificationEmail({ to, firstName, token, ttlMinutes });
  const result = await sendMail(message);
  // Log mínimo y no sensible (sin token ni enlace).
  // eslint-disable-next-line no-console
  console.log(`[mail] verificación → ${maskRecipient(to)} (${result.provider})`);
  return result;
}

async function sendInvitationMail({ to, firstName, token, inviterName }) {
  const message = invitationEmail({ to, firstName, token, inviterName });
  const result = await sendMail(message);
  // eslint-disable-next-line no-console
  console.log(`[mail] invitación → ${maskRecipient(to)} (${result.provider})`);
  return result;
}

async function sendPasswordResetMail({ to, firstName, token, ttlMinutes }) {
  const message = passwordResetEmail({ to, firstName, token, ttlMinutes });
  const result = await sendMail(message);
  // eslint-disable-next-line no-console
  console.log(`[mail] restablecimiento → ${maskRecipient(to)} (${result.provider})`);
  return result;
}

/* ------------------------------------------------------------------ *
 * Plantillas adicionales                                              *
 * ------------------------------------------------------------------ */

function passwordResetEmail({ to, firstName, token, ttlMinutes }) {
  const link = `${env.appUrl}/restablecer?token=${encodeURIComponent(token)}`;
  return {
    to,
    subject: 'CodeEvo ERP — Restablece tu contraseña',
    text:
      `Hola ${firstName || ''}:\n\n` +
      `Solicitaste restablecer la contraseña de tu cuenta en CodeEvo ERP. Abre este enlace (caduca en ${ttlMinutes} minutos):\n` +
      `${link}\n\n` +
      `Usa SÓLO el enlace de ESTE mensaje: cada solicitud deja sin efecto los anteriores.\n\n` +
      `Si tú no solicitaste este cambio, ignora este mensaje y considera cambiar tu contraseña.\n` +
      `— CodeEvo ERP`,
    html:
      `<p>Hola ${firstName || ''}:</p>` +
      `<p>Solicitaste restablecer la contraseña de tu cuenta en CodeEvo ERP. Pulsa el botón (caduca en ${ttlMinutes} minutos):</p>` +
      `<p><a href="${link}">Restablecer mi contraseña</a></p>` +
      `<p>Usa sólo el enlace de <strong>este</strong> mensaje: cada solicitud deja sin efecto los anteriores.</p>` +
      `<p>Si tú no solicitaste este cambio, ignora este mensaje y considera cambiar tu contraseña.</p>` +
      `<p>— CodeEvo ERP</p>`,
  };
}

module.exports = {
  isMailConfigured,
  sendMail,
  sendVerificationMail,
  sendInvitationMail,
  sendPasswordResetMail,
  drainTestOutbox,
};
