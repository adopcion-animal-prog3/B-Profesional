const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const router = express.Router();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVALID_CREDENTIALS = 'Invalid email or password';

router.post('/api/auth/login', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ status: 'error', message: 'Email and password are required' });
  }

  const { email, password } = body;
  if (typeof email !== 'string' || email.trim() === '' || email.length > 255 ||
      !EMAIL_PATTERN.test(email.trim()) || typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Email and password are required' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
    console.error('JWT_SECRET is not configured');
    return res.status(500).json({ status: 'error', message: 'Authentication service is not configured' });
  }

  try {
    const result = await query(
      'SELECT id, nombre, email, password_hash FROM usuarios WHERE LOWER(email) = $1',
      [email.trim().toLowerCase()]
    );
    const user = result.rows[0];

    if (!user || typeof user.password_hash !== 'string' ||
        !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ status: 'error', message: INVALID_CREDENTIALS });
    }

    const token = jwt.sign(
      { email: user.email },
      jwtSecret,
      { subject: String(user.id), expiresIn: '1h', algorithm: 'HS256' }
    );

    return res.status(200).json({
      status: 'success',
      data: {
        token,
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
        },
      },
    });
  } catch (error) {
    console.error('Error during login:', error.message);
    return res.status(500).json({ status: 'error', message: 'Error authenticating user' });
  }
});

module.exports = router;