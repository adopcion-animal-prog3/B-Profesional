const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useTestApp } = require('../helpers/testApp');
const { mascotaRow } = require('../helpers/fixtures');
const { tokenFor, bearer } = require('../helpers/auth');

// mascotaRow() pertenece al usuario 1 (creado_por: 1).
const owner = bearer(tokenFor({ id: 1, rol: 'ADMIN' }));
const otherPublisher = bearer(tokenFor({ id: 2, rol: 'ADMIN' }));

describe('PUT /api/mascotas/:id', () => {
  const api = useTestApp();

  it('actualiza solo los campos enviados con UPDATE parametrizado', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 3 })] }, { rows: [mascotaRow({ id: 3, nombre: 'Nuevo', edad: 4 })] });

    const res = await api.request('PUT', '/api/mascotas/3', { nombre: 'Nuevo', edad: 4 }, owner);

    const update = api.calls[1];
    assert.equal(res.status, 200);
    assert.equal(res.body.data.nombre, 'Nuevo');
    assert.match(update.text, /SET nombre = \$1, edad = \$2 WHERE id = \$3/);
    assert.deepEqual(update.params, ['Nuevo', 4, 3]);
  });

  it('permite reemplazar la imagen', async () => {
    const imagen = 'data:image/jpeg;base64,/9j/4AAQ';
    api.queueResults({ rows: [mascotaRow({ id: 3 })] }, { rows: [mascotaRow({ id: 3, imagen })] });

    const res = await api.request('PUT', '/api/mascotas/3', { imagen }, owner);

    assert.equal(res.status, 200);
    assert.deepEqual(api.calls[1].params, [imagen, 3]);
  });

  it('con cuerpo vacio devuelve la mascota actual sin ejecutar UPDATE', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 3 })] });

    const res = await api.request('PUT', '/api/mascotas/3', {}, owner);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, 3);
    assert.ok(api.calls.every((call) => !/^\s*UPDATE/i.test(call.text)));
  });

  it('devuelve 404 si la mascota no existe', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request('PUT', '/api/mascotas/404', { nombre: 'X' }, owner);

    assert.equal(res.status, 404);
    assert.equal(api.calls.length, 1);
  });

  it('devuelve 403 si la mascota la publicó otra cuenta', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 3 })] });

    const res = await api.request('PUT', '/api/mascotas/3', { nombre: 'X' }, otherPublisher);

    assert.equal(res.status, 403);
    assert.equal(api.calls.length, 1);
  });

  it('exige una cuenta profesional', async () => {
    const res = await api.request('PUT', '/api/mascotas/3', { nombre: 'X' }, bearer(tokenFor()));

    assert.equal(res.status, 403);
    assert.equal(api.calls.length, 0);
  });

  it('devuelve 400 para id invalido', async () => {
    const res = await api.request('PUT', '/api/mascotas/abc', { nombre: 'X' }, owner);

    assert.equal(res.status, 400);
    assert.equal(api.calls.length, 0);
  });

  const invalidBodies = {
    'nombre vacio': { nombre: '' },
    'edad negativa': { edad: -5 },
    'sexo invalido': { sexo: 'Z' },
    'adoptada no booleana': { adoptada: 'true' },
    'imagen invalida': { imagen: 'no-es-imagen' },
  };

  for (const [name, body] of Object.entries(invalidBodies)) {
    it(`devuelve 400 sin ejecutar UPDATE: ${name}`, async () => {
      api.queueResults({ rows: [mascotaRow({ id: 3 })] });

      const res = await api.request('PUT', '/api/mascotas/3', body, owner);

      assert.equal(res.status, 400);
      assert.ok(api.calls.every((call) => !/^\s*UPDATE/i.test(call.text)));
    });
  }

  it('devuelve 400 si el cuerpo es un arreglo', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 3 })] });

    const res = await api.request('PUT', '/api/mascotas/3', [], owner);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Request body is required');
  });
});
