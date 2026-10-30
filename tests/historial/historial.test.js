const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { tokenFor, bearer } = require('../helpers/auth');
const { useTestApp } = require('../helpers/testApp');

describe('Historial clínico', () => {
  const api = useTestApp();
  const adminHeaders = bearer(tokenFor({ id: 1, rol: 'ADMIN' }));
  const record = (overrides = {}) => ({
    id: 21,
    mascota_id: 3,
    fecha_registro: '2026-01-01T00:00:00.000Z',
    descripcion: 'Vacunación anual',
    veterinario: 'Dra. Torres',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: null,
    ...overrides,
  });

  it('lista el historial de una mascota para ADMIN', async () => {
    api.queueResults({ rows: [{ id: 3 }] }, { rows: [record()] });

    const res = await api.request('GET', '/api/mascotas/3/historial', undefined, adminHeaders);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, [record()]);
    assert.deepEqual(api.calls[0].params, [3]);
    assert.deepEqual(api.calls[1].params, [3]);
  });

  it('crea un registro clínico validado y parametrizado', async () => {
    api.queueResults({ rows: [{ id: 3 }] }, { rows: [record()] });

    const res = await api.request(
      'POST',
      '/api/mascotas/3/historial',
      { descripcion: ' Vacunación anual ', veterinario: ' Dra. Torres ' },
      adminHeaders
    );

    assert.equal(res.status, 201);
    assert.deepEqual(res.body.data, record());
    assert.deepEqual(api.calls[1].params, [3, 'Vacunación anual', 'Dra. Torres']);
  });

  it('rechaza una descripción vacía antes de consultar la base', async () => {
    const res = await api.request(
      'POST',
      '/api/mascotas/3/historial',
      { descripcion: '  ' },
      adminHeaders
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.status, 'error');
    assert.equal(api.calls.length, 0);
  });

  it('permite a ADMIN actualizar un registro clínico', async () => {
    api.queueResults({ rows: [{ id: 21 }] }, { rows: [record({ veterinario: 'Dr. Pérez' })] });

    const res = await api.request(
      'PUT',
      '/api/historial/21',
      { veterinario: 'Dr. Pérez' },
      adminHeaders
    );

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, record({ veterinario: 'Dr. Pérez' }));
    assert.deepEqual(api.calls[1].params, ['Dr. Pérez', 21]);
  });

  it('rechaza una fecha inválida antes de consultar la base', async () => {
    const res = await api.request(
      'PUT',
      '/api/historial/21',
      { fecha_registro: 'no-es-fecha' },
      adminHeaders
    );

    assert.equal(res.status, 400);
    assert.equal(api.calls.length, 0);
  });

  it('elimina un registro clínico para ADMIN', async () => {
    api.queueResults({ rows: [{ id: 21 }] }, { rows: [record()] });

    const res = await api.request('DELETE', '/api/historial/21', undefined, adminHeaders);

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, {
      message: 'Historial clinico deleted successfully',
      data: record(),
    });
    assert.deepEqual(api.calls[1].params, [21]);
  });

  it('deniega historial clínico a ADOPTANTE sin consultar la base', async () => {
    const res = await api.request(
      'GET',
      '/api/mascotas/3/historial',
      undefined,
      bearer(tokenFor())
    );

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'Insufficient permissions');
    assert.equal(api.calls.length, 0);
  });
});
