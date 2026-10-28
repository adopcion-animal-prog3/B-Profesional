const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useTestApp } = require('../helpers/testApp');
const { mascotaRow } = require('../helpers/fixtures');

describe('GET /api/mascotas/:id', () => {
  const api = useTestApp();

  it('devuelve 200 con la mascota y consulta con parametro', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 7 })] });

    const res = await api.request('GET', '/api/mascotas/7');

    assert.equal(res.status, 200);
    assert.equal(res.body.data.id, 7);
    assert.deepEqual(api.calls[0].params, [7]);
    assert.match(api.calls[0].text, /WHERE id = \$1/);
  });

  it('devuelve 404 si la mascota no existe', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request('GET', '/api/mascotas/999');

    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Mascota not found');
  });

  for (const badId of ['abc', '0', '-1', '1.5']) {
    it(`devuelve 400 sin consultar la BD para id invalido "${badId}"`, async () => {
      const res = await api.request('GET', `/api/mascotas/${badId}`);

      assert.equal(res.status, 400);
      assert.equal(res.body.message, 'Invalid id parameter');
      assert.equal(api.calls.length, 0);
    });
  }
});
