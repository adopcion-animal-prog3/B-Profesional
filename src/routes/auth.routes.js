const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const logger = require('../utils/logger');
const verification = require('../services/verification.service');

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CREDENTIALS = 'Invalid email or password';
// Este backend atiende el portal profesional: solo las cuentas ADMIN (publicadores) inician sesión aquí.
const PORTAL_ROLE = 'ADMIN';
const WRONG_PORTAL = 'This account belongs to the adoption portal; sign in there instead';

function validateRegistration(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'nombre, email and password are required';
  const { nombre, email, password } = body;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150) {
    return 'Field "nombre" is required and must not exceed 150 characters';
  }
  if (typeof email !== 'string' || email.trim().length > 255 || !EMAIL_PATTERN.test(email.trim())) {
    return 'Field "email" must be a valid email address';
  }
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    return 'Field "password" must have between 8 and 72 bytes';
  }
  return null;
}

const getPublicUser = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  rol: user.rol,
});

router.get('/api/auth/validate-token', authenticateToken, (req, res) => {
  return res.status(200).json(successResponse({ user: req.user }));
});

// Route to test ADMIN-only access
router.get('/api/auth/admin-only', authenticateToken, requireRole('ADMIN'), (req, res) => {
  return res.status(200).json(successResponse({ message: 'admin access granted' }));
});

// Route to test ADOPTANTE-only access
router.get('/api/auth/adoptante-only', authenticateToken, requireRole('ADOPTANTE'), (req, res) => {
  return res.status(200).json(successResponse({ message: 'adoptante access granted' }));
});

const signToken = (user) => jwt.sign(
  { id: user.id, email: user.email, rol: user.rol },
  process.env.JWT_SECRET,
  { subject: String(user.id), expiresIn: '1h', algorithm: 'HS256' },
);

const findUserByEmail = async (email) => {
  const result = await query(
    'SELECT id, nombre, email, rol, password_hash FROM usuarios WHERE LOWER(email) = $1',
    [email.toLowerCase()],
  );
  return result.rows[0] || null;
};

const isValidEmail = (email) =>
  typeof email === 'string' && email.trim().length <= 255 && EMAIL_PATTERN.test(email.trim());

async function passwordMatches(user, password) {
  if (typeof user?.password_hash !== 'string') return false;
  try {
    return await bcrypt.compare(password, user.password_hash);
  } catch (error) {
    logger.warn(`Hash de contraseña almacenado inválido para el usuario ${user.id}: ${error.message}`);
    return false;
  }
}

const requireJwtSecret = (req, res, next) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
    logger.error('JWT_SECRET no está configurado');
    return res.status(500).json(errorResponse('Authentication service is not configured'));
  }
  return next();
};

// Paso 1 del login: valida la contraseña y envía un código al email (202).
router.post('/api/auth/login', requireJwtSecret, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!isValidEmail(email) || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json(errorResponse('Email and password are required'));
  }

  const user = await findUserByEmail(email.trim());
  if (!user || !(await passwordMatches(user, password))) {
    return res.status(401).json(errorResponse(INVALID_CREDENTIALS));
  }
  if (user.rol !== PORTAL_ROLE) {
    return res.status(403).json(errorResponse(WRONG_PORTAL));
  }

  const verificacion = await verification.issueCode(user, 'LOGIN');
  return res.status(202).json(successResponse({ verificacion_requerida: true, verificacion }));
}));

// Paso 2 (login o registro): valida el código recibido por email y entrega el token.
router.post('/api/auth/verify', requireJwtSecret, asyncHandler(async (req, res) => {
  const { email, codigo } = req.body || {};
  if (!isValidEmail(email) || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo.trim())) {
    return res.status(400).json(errorResponse('Email and a 6-digit codigo are required'));
  }

  const user = await findUserByEmail(email.trim());
  if (!user || user.rol !== PORTAL_ROLE) {
    return res.status(400).json(errorResponse('Invalid verification code'));
  }
  await verification.consumeCode(user.id, codigo.trim());
  return res.status(200).json(successResponse({ token: signToken(user), user: getPublicUser(user) }));
}));

// Reenvía el código pendiente. Responde igual exista o no la cuenta.
router.post('/api/auth/resend-code', asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json(errorResponse('A valid email is required'));

  const user = await findUserByEmail(email.trim());
  if (user && user.rol === PORTAL_ROLE) await verification.resendCode(user);
  return res.status(200).json(successResponse({ message: 'If a verification is pending, a new code was sent' }));
}));

router.post('/api/auth/register', asyncHandler(async (req, res) => {
  const validationError = validateRegistration(req.body);
  if (validationError) {
    return res.status(400).json(errorResponse(validationError));
  }

  const email = req.body.email.trim().toLowerCase();
  const existing = await query('SELECT id FROM usuarios WHERE LOWER(email) = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json(errorResponse('Email already registered'));
  }

  const passwordHash = await bcrypt.hash(req.body.password, 10);
  const result = await query(
    'INSERT INTO usuarios (nombre, email, password_hash, rol, email_verificado) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, email, rol',
    [req.body.nombre.trim(), email, passwordHash, PORTAL_ROLE, false],
  );
  const user = result.rows[0];
  const verificacion = await verification.issueCode(user, 'REGISTRO');
  return res.status(201).json(successResponse({
    ...getPublicUser(user),
    verificacion_requerida: true,
    verificacion,
  }));
}));

// Traduce los errores de verificación (código inválido, vencido, demasiados intentos).
router.use('/api/auth', (error, req, res, next) => {
  if (error instanceof verification.VerificationError) {
    return res.status(error.statusCode).json(errorResponse(error.message));
  }
  return next(error);
});

module.exports = router;
