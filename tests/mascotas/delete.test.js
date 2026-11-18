const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useTestApp } = require('../helpers/testApp');
const { mascotaRow } = require('../helpers/fixtures');
const { tokenFor, bearer } = require('../helpers/auth');

const owner = bearer(tokenFor({ id: 1, rol: 'ADMIN' }));

describe('DELETE /api/mascotas/:id', () => {
  const api = useTestApp();

  it('elimina la mascota y devuelve 200 con la fila eliminada', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 5 })] }, { rows: [mascotaRow({ id: 5 })] });

    const res = await api.request('DELETE', '/api/mascotas/5', undefined, owner);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.message, 'Mascota deleted successfully');
    assert.equal(res.body.data.data.id, 5);
    assert.match(api.calls[1].text, /DELETE FROM mascotas WHERE id = \$1/);
    assert.deepEqual(api.calls[1].params, [5]);
  });

  it('permite gestionar mascotas sin publicador registrado', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 5, creado_por: null })] }, { rows: [mascotaRow({ id: 5 })] });

    const res = await api.request('DELETE', '/api/mascotas/5', undefined, bearer(tokenFor({ id: 9, rol: 'ADMIN' })));

    assert.equal(res.status, 200);
  });

  it('devuelve 403 si otra cuenta intenta eliminarla', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 5 })] });

    const res = await api.request('DELETE', '/api/mascotas/5', undefined, bearer(tokenFor({ id: 2, rol: 'ADMIN' })));

    assert.equal(res.status, 403);
    assert.equal(api.calls.length, 1);
  });

  it('exige autenticación', async () => {
    const res = await api.request('DELETE', '/api/mascotas/5');

    assert.equal(res.status, 401);
    assert.equal(api.calls.length, 0);
  });

  it('devuelve 404 y no ejecuta DELETE si no existe', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request('DELETE', '/api/mascotas/999', undefined, owner);

    assert.equal(res.status, 404);
    assert.equal(api.calls.length, 1);
  });

  it('devuelve 400 para id invalido', async () => {
    const res = await api.request('DELETE', '/api/mascotas/-3', undefined, owner);

    assert.equal(res.status, 400);
    assert.equal(api.calls.length, 0);
  });

  it('responde 500 generico si falla la BD', async () => {
    api.queueResults(new Error('boom interno'));

    const res = await api.request('DELETE', '/api/mascotas/5', undefined, owner);

    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(res.body), /boom/);
  });
});
