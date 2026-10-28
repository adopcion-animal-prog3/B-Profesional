const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useTestApp } = require('../helpers/testApp');
const { mascotaRow } = require('../helpers/fixtures');

describe('PUT /api/mascotas/:id', () => {
  const api = useTestApp();

  it('actualiza solo los campos enviados con UPDATE parametrizado', async () => {
    api.queueResults({ rows: [{ id: 3 }] }, { rows: [mascotaRow({ id: 3, nombre: 'Nuevo', edad: 4 })] });

    const res = await api.request('PUT', '/api/mascotas/3', { nombre: 'Nuevo', edad: 4 });

    const update = api.calls[1];
    assert.equal(res.status, 200);
    assert.equal(res.body.data.nombre, 'Nuevo');
    assert.match(update.text, /SET nombre = \$1, edad = \$2 WHERE id = \$3/);
    assert.deepEqual(update.params, ['Nuevo', 4, 3]);
  });

  it('con cuerpo vacio devuelve la mascota actual sin ejecutar UPDATE', async () => {
    api.queueResults({ rows: [{ id: 3 }] }, { rows: [mascotaRow({ id: 3 })] });

    const res = await api.request('PUT', '/api/mascotas/3', {});

    assert.equal(res.status, 200);
    assert.equal(api.calls.length, 2);
    assert.ok(api.calls.every((call) => !/^\s*UPDATE/i.test(call.text)));
  });

  it('devuelve 404 si la mascota no existe', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request('PUT', '/api/mascotas/404', { nombre: 'X' });

    assert.equal(res.status, 404);
    assert.equal(api.calls.length, 1);
  });

  it('devuelve 400 para id invalido', async () => {
    const res = await api.request('PUT', '/api/mascotas/abc', { nombre: 'X' });

    assert.equal(res.status, 400);
    assert.equal(api.calls.length, 0);
  });

  const invalidBodies = {
    'nombre vacio': { nombre: '' },
    'edad negativa': { edad: -5 },
    'sexo invalido': { sexo: 'Z' },
    'adoptada no booleana': { adoptada: 'true' },
  };

  for (const [name, body] of Object.entries(invalidBodies)) {
    it(`devuelve 400 sin tocar la BD: ${name}`, async () => {
      const res = await api.request('PUT', '/api/mascotas/3', body);

      assert.equal(res.status, 400);
      assert.equal(api.calls.length, 0);
    });
  }

  it('devuelve 400 si el cuerpo es un arreglo', async () => {
    const res = await api.request('PUT', '/api/mascotas/3', []);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Request body is required');
  });
});
