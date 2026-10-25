'use strict';

/**
 * Auditoría NO destructiva de datos de contacto (clientes y proveedores)
 * frente a las reglas actuales: teléfono MX de exactamente 10 dígitos,
 * email con formato válido, nombre ≥ 2 caracteres.
 *
 * Uso (nunca contra producción sin confirmación explícita):
 *   node scripts/audit-contact-data.js               # sólo informe (dry-run)
 *   node scripts/audit-contact-data.js --apply       # aplica normalizaciones seguras
 *   node scripts/audit-contact-data.js --allow-remote --apply   # req. además CONFIRM_REMOTE=yes
 *
 * Qué hace --apply (SÓLO normalizaciones seguras, jamás borra datos):
 *   - teléfono: conserva únicamente dígitos; si quedan exactamente 10, lo aplica.
 *   - email: recorta espacios y pasa a minúsculas.
 * Lo que NUNCA toca (se informa para revisión manual):
 *   - teléfonos que tras quitar símbolos no quedan en 10 dígitos.
 *   - emails ausentes o con formato inválido (no se inventan datos).
 *   - nombres demasiado cortos.
 *
 * Los valores se muestran enmascarados; no se imprimen credenciales ni tokens.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const PHONE_RX = /^[0-9]{10}$/;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const ALLOW_REMOTE = args.has('--allow-remote');

function maskPhone(v) {
  const s = String(v ?? '');
  return s.length > 4 ? `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}` : '****';
}
function maskEmail(v) {
  const s = String(v ?? '');
  const at = s.lastIndexOf('@');
  if (at <= 0) return '****';
  return `${s[0]}***${s.slice(at)}`;
}

function classifyPhone(value) {
  if (value == null || String(value).trim() === '') return { issue: 'phone-missing', normalizable: false };
  const raw = String(value).trim();
  if (PHONE_RX.test(raw)) return { issue: null };
  const digits = raw.replace(/\D/g, '');
  if (PHONE_RX.test(digits)) return { issue: 'phone-format', normalizable: true, fix: digits };
  return { issue: 'phone-invalid', normalizable: false, digits: digits.length };
}

function classifyEmail(value) {
  if (value == null || String(value).trim() === '') return { issue: 'email-missing', normalizable: false };
  const raw = String(value);
  const norm = raw.trim().toLowerCase();
  if (!EMAIL_RX.test(norm)) return { issue: 'email-invalid', normalizable: false };
  if (norm !== raw) return { issue: 'email-normalize', normalizable: true, fix: norm };
  return { issue: null };
}

async function auditModel(Model, label) {
  const docs = await Model.find({}).lean();
  const report = { checked: docs.length, clean: 0, findings: [], applied: 0 };

  for (const doc of docs) {
    const fixes = {};
    let manual = 0;

    const phone = classifyPhone(doc.phone);
    const email = classifyEmail(doc.email);
    const nameIssue = typeof doc.name === 'string' && doc.name.trim().length < 2 ? 'name-too-short' : null;

    if (phone.issue) {
      if (phone.normalizable) fixes.phone = phone.fix;
      else manual += 1;
      report.findings.push({
        id: String(doc._id),
        companyId: String(doc.companyId),
        field: 'phone',
        issue: phone.issue,
        current: maskPhone(doc.phone),
        proposed: phone.normalizable ? maskPhone(phone.fix) : '(revisión manual)',
      });
    }
    if (email.issue) {
      if (email.normalizable) fixes.email = email.fix;
      else manual += 1;
      report.findings.push({
        id: String(doc._id),
        companyId: String(doc.companyId),
        field: 'email',
        issue: email.issue,
        current: maskEmail(doc.email),
        proposed: email.normalizable ? maskEmail(email.fix) : '(revisión manual)',
      });
    }
    if (nameIssue) {
      manual += 1;
      report.findings.push({
        id: String(doc._id),
        companyId: String(doc.companyId),
        field: 'name',
        issue: nameIssue,
        current: '(enmascarado)',
        proposed: '(revisión manual)',
      });
    }

    const hasFixes = Object.keys(fixes).length > 0;
    if (!phone.issue && !email.issue && !nameIssue) report.clean += 1;

    if (APPLY && hasFixes) {
      await Model.updateOne({ _id: doc._id }, { $set: fixes });
      report.applied += 1;
    } else if (hasFixes) {
      report.pendingFix = (report.pendingFix || 0) + 1;
    }
  }

  console.log(`\n=== ${label} ===`);
  console.log(`revisados: ${report.checked} | conformes: ${report.clean} | hallazgos: ${report.findings.length}` + (APPLY ? ` | normalizados: ${report.applied}` : ` | normalizables: ${report.pendingFix || 0}`));
  for (const f of report.findings) {
    console.log(` - ${f.id} [empresa ${f.companyId}] ${f.field}: ${f.issue} → actual ${f.current} | propuesto ${f.proposed}`);
  }
  return report;
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[audit] Falta MONGO_URI en el entorno/.env');
    process.exit(1);
  }
  const isLocal = /127\.0\.0\.1|localhost/.test(uri);
  if (!isLocal) {
    if (!ALLOW_REMOTE) {
      console.error('[audit] MONGO_URI apunta a un host remoto. Este script está pensado para la BD local de pruebas.');
      console.error('[audit] Para una BD remota autorizada, añade --allow-remote y CONFIRM_REMOTE=yes (nunca en producción sin respaldo y ventana de mantenimiento).');
      process.exit(1);
    }
    if (process.env.CONFIRM_REMOTE !== 'yes') {
      console.error('[audit] Host remoto detectado: falta CONFIRM_REMOTE=yes para continuar.');
      process.exit(1);
    }
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`[audit] conectado a ${isLocal ? 'base local' : 'base remota'} (${mongoose.connection.name}) — modo ${APPLY ? 'APPLY (normaliza)' : 'DRY-RUN (sólo informe)'}`);

  const Customer = require('../src/modules/customers/model');
  const Supplier = require('../src/modules/suppliers/model');

  const r1 = await auditModel(Customer, 'CLIENTES');
  const r2 = await auditModel(Supplier, 'PROVEEDORES');

  const totalFindings = r1.findings.length + r2.findings.length;
  console.log(`\n[audit] Total hallazgos: ${totalFindings}. ${APPLY ? 'Normalizaciones aplicadas (sólo seguras).' : 'Nada modificado. Revisa los "(revisión manual)" antes de migrar.'}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[audit] Error:', err.message);
  process.exit(1);
});
