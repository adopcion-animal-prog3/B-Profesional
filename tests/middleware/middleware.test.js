const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const authenticateToken = require('../../src/middleware/auth.middleware');
const requireRole = require('../../src/middleware/role.middleware');
const { errorHandler, normalizeError, createHttpError } = require('../../src/middleware/error.middleware');

const SECRET = 'middleware-tests-only-secret';

// Respuesta mínima de Express que registra el estado y el cuerpo enviados.
const fakeResponse = () => {
  const res = { statusCode: null, body: null, headersSent: false };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

const runAuth = (authorization) => {
  const req = { headers: authorization ? { authorization } : {} };
  const res = fakeResponse();
  let nextCalled = false;
  authenticateToken(req, res, () => {
    nextCalled = true;
  });
  return { req, res, nextCalled };
};

describe('middleware de autenticación', () => {
  let previousSecret;
  before(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = SECRET;
  });
  after(() => {
    process.env.JWT_SECRET = previousSecret;
  });

  it('rechaza pedidos sin token o con esquema inválido', () => {
    assert.equal(runAuth().res.statusCode, 401);
    assert.equal(runAuth('Basic abc').res.body.message, 'Invalid authorization header');
  });

  it('distingue token vencido de token inválido', () => {
    const expired = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET);
    assert.equal(runAuth(`Bearer ${expired}`).res.body.message, 'Token expired');
    assert.equal(runAuth('Bearer no-es-un-jwt').res.body.message, 'Invalid token');
  });

  it('acepta un token válido y adjunta el usuario', () => {
    const token = jwt.sign({ id: 3, rol: 'ADMIN' }, SECRET, { algorithm: 'HS256' });
    const { req, nextCalled } = runAuth(`Bearer ${token}`);
    assert.equal(nextCalled, true);
    assert.equal(req.user.rol, 'ADMIN');
  });

  it('informa error de configuración si falta JWT_SECRET', () => {
    process.env.JWT_SECRET = ' ';
    const originalError = console.error;
    console.error = () => {};
    try {
      assert.equal(runAuth('Bearer algo').res.statusCode, 500);
    } finally {
      console.error = originalError;
      process.env.JWT_SECRET = SECRET;
    }
  });
});

describe('middleware de roles', () => {
  const runRole = (roles, user) => {
    const res = fakeResponse();
    let nextCalled = false;
    requireRole(roles)({ user }, res, () => {
      nextCalled = true;
    });
    return { res, nextCalled };
  };

  it('exige usuario autenticado y un rol válido', () => {
    assert.equal(runRole('ADMIN', undefined).res.statusCode, 401);
    assert.equal(runRole('ADMIN', { id: 1 }).res.statusCode, 403);
    assert.equal(runRole(['ADMIN'], { role: 'ADOPTANTE' }).res.statusCode, 403);
  });

  it('deja pasar a los roles permitidos', () => {
    assert.equal(runRole(['ADMIN', 'ADOPTANTE'], { rol: 'ADOPTANTE' }).nextCalled, true);
  });
});

describe('manejo centralizado de errores', () => {
  it('traduce errores de PostgreSQL y de JWT a códigos HTTP', () => {
    assert.equal(normalizeError({ name: 'TokenExpiredError' }).statusCode, 401);
    assert.equal(normalizeError({ code: '23505' }).statusCode, 409);
    assert.equal(normalizeError({ code: '23503' }).statusCode, 400);
    assert.equal(normalizeError({ code: '23514' }).statusCode, 400);
    assert.equal(normalizeError({ code: 'ECONNREFUSED' }).statusCode, 500);
    assert.equal(normalizeError({ statusCode: 422, message: 'Inválido' }).message, 'Inválido');
    assert.equal(normalizeError({ statusCode: 418 }).message, 'Request failed');
    assert.equal(normalizeError(new Error('x')).statusCode, 500);
  });

  it('oculta el detalle de los errores 500 y respeta las respuestas ya enviadas', () => {
    const res = fakeResponse();
    errorHandler(new Error('detalle interno'), {}, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, 'Internal server error');

    const sent = { ...fakeResponse(), headersSent: true };
    let forwarded = null;
    errorHandler(createHttpError(400, 'x'), {}, sent, (error) => {
      forwarded = error;
    });
    assert.equal(forwarded.statusCode, 400);
  });
});
