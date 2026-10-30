const jwt = require('jsonwebtoken');

const TEST_JWT_SECRET = 'automated-tests-only-secret';
process.env.JWT_SECRET = TEST_JWT_SECRET;

const tokenFor = (overrides = {}) => jwt.sign({
  id: 7,
  email: 'adoptante@example.test',
  rol: 'ADOPTANTE',
  ...overrides,
}, TEST_JWT_SECRET, { algorithm: 'HS256' });

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { tokenFor, bearer };
