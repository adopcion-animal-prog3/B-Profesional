// Envío de correos. Modos (MAIL_MODE):
//   smtp   -> envía por SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE, MAIL_FROM)
//   log    -> escribe el correo en el log del servidor (solo desarrollo, sin SMTP configurado)
//   memory -> guarda los correos en `outbox` (pruebas automatizadas)
const logger = require('../utils/logger');

const outbox = [];
let transporter = null;

const getMode = () => process.env.MAIL_MODE || (process.env.SMTP_HOST ? 'smtp' : 'log');

function getTransporter() {
  if (transporter) return transporter;
  const nodemailer = require('nodemailer');
  const user = process.env.SMTP_USER;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: user ? { user, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const mode = getMode();
  if (mode === 'memory') {
    outbox.push({ to, subject, text, html });
    return;
  }
  if (mode === 'log') {
    logger.info(`[mail] Para: ${to} | ${subject}\n${text}`);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || 'Huellitas <no-reply@huellitas.local>',
    to,
    subject,
    text,
    html,
  });
}

module.exports = { sendMail, outbox };
