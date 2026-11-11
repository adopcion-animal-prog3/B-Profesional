const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useTestApp } = require('../helpers/testApp');
const { mascotaRow } = require('../helpers/fixtures');

describe('GET /api/mascotas', () => {
  const api = useTestApp();

  it('devuelve 200 con la lista y el contador', async () => {
    const rows = [mascotaRow(), mascotaRow({ id: 2, nombre: 'Simon', especie: 'Gato' })];
    api.queueResults({ rows });

    const res = await api.request('GET', '/api/mascotas');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, rows);
    assert.equal(res.body.count, 2);
  });

  it('devuelve una lista vacia cuando no hay mascotas', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request('GET', '/api/mascotas');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
    assert.equal(res.body.count, 0);
  });

  it('responde 500 generico sin filtrar detalles si falla la BD', async () => {
    api.queueResults(new Error('connection refused to db-host'));

    const res = await api.request('GET', '/api/mascotas');

    assert.equal(res.status, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Internal server error');
    assert.doesNotMatch(JSON.stringify(res.body), /db-host/);
  });
});
