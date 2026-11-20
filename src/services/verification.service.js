// Códigos de verificación por email para registro e inicio de sesión.
const crypto = require('crypto');
const { query } = require('../config/database');
const { sendMail } = require('./mailer.service');
const { buildCodeEmail } = require('./emailTemplates');

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const CODE_COLUMNS = 'id, usuario_id, proposito, codigo_hash, intentos, usado, expira_en, created_at';

class VerificationError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const hashCode = (userId, code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || '').update(`${userId}:${code}`).digest('hex');

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

async function findActiveCode(userId) {
  const result = await query(
    `SELECT ${CODE_COLUMNS} FROM codigos_verificacion WHERE usuario_id = $1 AND usado = $2 ORDER BY id DESC`,
    [userId, false],
  );
  return result.rows[0] || null;
}

async function invalidateCodes(userId) {
  await query(
    'UPDATE codigos_verificacion SET usado = $1 WHERE usuario_id = $2 AND usado = $3 RETURNING id',
    [true, userId, false],
  );
}

// Genera un código nuevo (invalidando los anteriores) y lo envía por email.
async function issueCode(user, proposito) {
  await invalidateCodes(user.id);
  const code = generateCode();
  const expiraEn = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();
  await query(
    'INSERT INTO codigos_verificacion (usuario_id, proposito, codigo_hash, intentos, usado, expira_en) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [user.id, proposito, hashCode(user.id, code), 0, false, expiraEn],
  );
  await sendMail({ to: user.email, ...buildCodeEmail({ nombre: user.nombre, code, proposito, minutes: CODE_TTL_MINUTES }) });
  return { email: user.email, proposito, expira_en_minutos: CODE_TTL_MINUTES };
}

async function resendCode(user) {
  const active = await findActiveCode(user.id);
  if (!active) return null;
  const elapsed = (Date.now() - new Date(active.created_at).getTime()) / 1000;
  if (elapsed < RESEND_COOLDOWN_SECONDS) {
    throw new VerificationError(429, 'Wait a minute before requesting a new code');
  }
  return issueCode(user, active.proposito);
}

// Comprueba el código: vigente, no usado y con intentos disponibles.
async function consumeCode(userId, code) {
  const active = await findActiveCode(userId);
  if (!active || new Date(active.expira_en).getTime() < Date.now()) {
    throw new VerificationError(400, 'The code expired; request a new one');
  }
  if (active.intentos >= MAX_ATTEMPTS) {
    throw new VerificationError(429, 'Too many attempts; request a new code');
  }
  const expected = Buffer.from(active.codigo_hash, 'hex');
  const received = Buffer.from(hashCode(userId, code), 'hex');
  if (!crypto.timingSafeEqual(expected, received)) {
    await query('UPDATE codigos_verificacion SET intentos = $1 WHERE id = $2 RETURNING id', [active.intentos + 1, active.id]);
    throw new VerificationError(400, 'Invalid verification code');
  }
  await query('UPDATE codigos_verificacion SET usado = $1 WHERE id = $2 RETURNING id', [true, active.id]);
  await query('UPDATE usuarios SET email_verificado = $1 WHERE id = $2 RETURNING id', [true, userId]);
}

module.exports = { VerificationError, issueCode, resendCode, consumeCode, CODE_TTL_MINUTES, MAX_ATTEMPTS };
