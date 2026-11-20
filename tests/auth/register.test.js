const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
require('../helpers/auth');
const { useTestApp } = require('../helpers/testApp');

describe('Registro y portal profesional', () => {
  const api = useTestApp();
  const body = { nombre: ' Refugio Sur ', email: 'Sur@Refugio.test', password: 'clave-segura' };

  it('registra una cuenta profesional (ADMIN) sin verificar y le envía un código', async () => {
    api.queueResults(
      { rows: [] },
      { rows: [{ id: 4, nombre: 'Refugio Sur', email: 'sur@refugio.test', rol: 'ADMIN' }] },
      { rows: [] },
      { rows: [{ id: 1 }] }
    );

    const res = await api.request('POST', '/api/auth/register', body);

    assert.equal(res.status, 201);
    assert.equal(res.body.data.rol, 'ADMIN');
    assert.equal(res.body.data.verificacion_requerida, true);
    assert.equal(res.body.data.verificacion.proposito, 'REGISTRO');
    assert.equal(api.calls[1].params[4], false);
    const [nombre, email, hash, rol] = api.calls[1].params;
    assert.deepEqual([nombre, email, rol], ['Refugio Sur', 'sur@refugio.test', 'ADMIN']);
    assert.notEqual(hash, body.password);
    assert.equal(await bcrypt.compare(body.password, hash), true);
  });

  it('devuelve 409 si el email ya está registrado', async () => {
    api.queueResults({ rows: [{ id: 1 }] });

    const res = await api.request('POST', '/api/auth/register', body);

    assert.equal(res.status, 409);
    assert.equal(api.calls.length, 1);
  });

  const invalid = {
    'sin cuerpo': [],
    'nombre vacío': { ...body, nombre: '  ' },
    'email inválido': { ...body, email: 'no-es-email' },
    'contraseña corta': { ...body, password: '123' },
  };

  for (const [name, payload] of Object.entries(invalid)) {
    it(`devuelve 400 sin consultar la BD: ${name}`, async () => {
      const res = await api.request('POST', '/api/auth/register', payload);

      assert.equal(res.status, 400);
      assert.equal(api.calls.length, 0);
    });
  }

  it('rechaza con 403 el login de una cuenta de adoptante', async () => {
    api.queueResults({
      rows: [{
        id: 7,
        nombre: 'Adoptante',
        email: 'adoptante@example.test',
        rol: 'ADOPTANTE',
        password_hash: bcrypt.hashSync('test-only-password', 4),
      }],
    });

    const res = await api.request('POST', '/api/auth/login', {
      email: 'adoptante@example.test',
      password: 'test-only-password',
    });

    assert.equal(res.status, 403);
    assert.match(res.body.message, /adoption portal/);
    assert.equal(res.body.data, undefined);
  });
});
