const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useTestApp } = require('../helpers/testApp');

describe('Health checks y contrato OpenAPI', () => {
  const api = useTestApp();

  it('responde health del proceso sin consultar PostgreSQL', async () => {
    const res = await api.request('GET', '/health');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { status: 'ok' });
    assert.equal(api.calls.length, 0);
  });

  it('verifica la conexión a PostgreSQL y devuelve la hora de la base', async () => {
    const databaseTime = '2026-10-30T12:00:00.000Z';
    api.queueResults({ rows: [{ ok: 1, current_time: databaseTime }] });

    const res = await api.request('GET', '/api/db-check');

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, { status: 'ok', databaseTime });
    assert.match(api.calls[0].text, /SELECT 1/);
  });

  it('devuelve 503 y conserva el formato de error si PostgreSQL no está disponible', async () => {
    api.queueResults(new Error('connection refused'));
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const res = await api.request('GET', '/api/db-check');

      assert.equal(res.status, 503);
      assert.equal(res.body.success, false);
      assert.equal(res.body.status, 'error');
      assert.equal(res.body.message, 'Database is unavailable');
      assert.deepEqual(res.body.error, { message: 'Database is unavailable' });
    } finally {
      console.error = originalConsoleError;
    }
  });

  it('publica OpenAPI con seguridad limitada a las rutas protegidas', async () => {
    const res = await api.request('GET', '/api-docs.json');
    const { paths, security } = res.body;

    assert.equal(res.status, 200);
    assert.equal(res.body.openapi, '3.0.3');
    assert.equal(security, undefined);
    assert.equal(paths['/health'].get.security, undefined);
    assert.equal(paths['/api/auth/login'].post.security, undefined);
    assert.deepEqual(paths['/api/solicitudes'].post.security, [{ bearerAuth: [] }]);
    assert.deepEqual(paths['/api/mascotas/{id}/historial'].get.security, [{ bearerAuth: [] }]);
    assert.deepEqual(
      Object.keys(paths['/api/mascotas/{id}'].delete.responses[200]
        .content['application/json'].schema.properties.data.properties),
      ['message', 'data']
    );
    assert.deepEqual(
      Object.keys(paths['/api/historial/{id}'].delete.responses[200]
        .content['application/json'].schema.properties.data.properties),
      ['message', 'data']
    );
  });

  it('responde rutas inexistentes con el formato de error de la API', async () => {
    const res = await api.request('GET', '/ruta-inexistente');

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.status, 'error');
    assert.equal(res.body.message, 'Route not found');
    assert.deepEqual(res.body.error, { message: 'Route not found' });
  });
});
