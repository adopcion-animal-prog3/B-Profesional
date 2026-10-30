const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { tokenFor, bearer } = require('../helpers/auth');
const { useTestApp } = require('../helpers/testApp');

describe('Autenticación y autorización', () => {
  const api = useTestApp();
  const testUser = {
    id: 7,
    nombre: 'Adoptante de prueba',
    email: 'adoptante@example.test',
    rol: 'ADOPTANTE',
    password_hash: bcrypt.hashSync('test-only-password', 4),
  };

  it('inicia sesión con credenciales válidas y devuelve un token y datos públicos', async () => {
    api.queueResults({ rows: [testUser] });

    const res = await api.request('POST', '/api/auth/login', {
      email: '  ADOPTANTE@example.test ',
      password: 'test-only-password',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data.user, {
      id: testUser.id,
      nombre: testUser.nombre,
      email: testUser.email,
      rol: testUser.rol,
    });
    assert.equal(res.body.data.token.length > 0, true);
    assert.equal(jwt.verify(res.body.data.token, process.env.JWT_SECRET).id, testUser.id);
    assert.deepEqual(api.calls[0].params, ['adoptante@example.test']);
  });

  it('rechaza una contraseña incorrecta con 401', async () => {
    api.queueResults({ rows: [testUser] });

    const res = await api.request('POST', '/api/auth/login', {
      email: testUser.email,
      password: 'wrong-test-password',
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  it('rechaza un usuario inexistente con el mismo error de credenciales', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request('POST', '/api/auth/login', {
      email: 'unknown@example.test',
      password: 'test-only-password',
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid email or password');
  });

  it('rechaza el acceso protegido cuando no se envía token', async () => {
    const res = await api.request('GET', '/api/auth/validate-token');

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Authentication required');
  });

  it('rechaza un token inválido', async () => {
    const res = await api.request('GET', '/api/auth/validate-token', undefined, bearer('invalid-token'));

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Invalid token');
  });

  it('permite al rol ADMIN acceder al endpoint administrativo', async () => {
    const res = await api.request(
      'GET',
      '/api/auth/admin-only',
      undefined,
      bearer(tokenFor({ id: 1, rol: 'ADMIN' }))
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.message, 'admin access granted');
  });

  it('restringe el endpoint administrativo al rol ADMIN', async () => {
    const res = await api.request('GET', '/api/auth/admin-only', undefined, bearer(tokenFor()));

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'Insufficient permissions');
  });

  it('permite al rol ADOPTANTE acceder a su endpoint y restringe otros roles', async () => {
    const allowed = await api.request('GET', '/api/auth/adoptante-only', undefined, bearer(tokenFor()));
    const denied = await api.request(
      'GET',
      '/api/auth/adoptante-only',
      undefined,
      bearer(tokenFor({ id: 1, rol: 'ADMIN' }))
    );

    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.data.message, 'adoptante access granted');
    assert.equal(denied.status, 403);
    assert.equal(denied.body.message, 'Insufficient permissions');
  });
});
