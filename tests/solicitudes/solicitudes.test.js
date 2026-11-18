const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { tokenFor, bearer } = require('../helpers/auth');
const { useTestApp } = require('../helpers/testApp');

describe('Solicitudes de adopción', () => {
  const api = useTestApp();
  const solicitud = (overrides = {}) => ({
    id: 12,
    usuario_id: 7,
    mascota_id: 3,
    estado: 'PENDIENTE',
    mensaje: 'Quiero adoptar',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('permite a ADOPTANTE crear una solicitud válida', async () => {
    api.queueResults(
      { rows: [{ id: 3, adoptada: false }] },
      { rows: [solicitud()] }
    );

    const res = await api.request(
      'POST',
      '/api/solicitudes',
      { mascota_id: 3, mensaje: 'Quiero adoptar' },
      bearer(tokenFor())
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, solicitud());
    assert.deepEqual(api.calls[0].params, [3]);
    assert.deepEqual(api.calls[1].params, [7, 3, 'PENDIENTE', 'Quiero adoptar']);
  });

  it('rechaza la creación sin token', async () => {
    const res = await api.request('POST', '/api/solicitudes', { mascota_id: 3 });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Authentication required');
    assert.equal(api.calls.length, 0);
  });

  it('devuelve 404 si la mascota solicitada no existe', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request(
      'POST',
      '/api/solicitudes',
      { mascota_id: 999 },
      bearer(tokenFor())
    );

    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Mascota not found');
    assert.equal(api.calls.length, 1);
  });

  it('lista para ADMIN solo las solicitudes de sus mascotas, con nombres', async () => {
    api.queueResults(
      { rows: [solicitud(), solicitud({ id: 13, usuario_id: 8, mascota_id: 4 })] },
      { rows: [{ id: 3, nombre: 'Luna', creado_por: 1 }, { id: 4, nombre: 'Max', creado_por: 2 }] },
      { rows: [{ id: 7, nombre: 'Ana' }, { id: 8, nombre: 'Beto' }] }
    );

    const res = await api.request(
      'GET',
      '/api/solicitudes',
      undefined,
      bearer(tokenFor({ id: 1, rol: 'ADMIN' }))
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.data[0].id, 12);
    assert.equal(res.body.data[0].mascota_nombre, 'Luna');
    assert.equal(res.body.data[0].usuario_nombre, 'Ana');
    assert.doesNotMatch(api.calls[0].text, /WHERE usuario_id/);
  });

  it('limita el listado de ADOPTANTE a sus solicitudes', async () => {
    api.queueResults({ rows: [solicitud()] });

    const res = await api.request('GET', '/api/solicitudes', undefined, bearer(tokenFor()));

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, [solicitud()]);
    assert.deepEqual(api.calls[0].params, [7]);
    assert.match(api.calls[0].text, /WHERE usuario_id = \$1/);
  });

  it('consulta una solicitud individual existente', async () => {
    api.queueResults({ rows: [solicitud()] });

    const res = await api.request('GET', '/api/solicitudes/12', undefined, bearer(tokenFor()));

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, solicitud());
    assert.deepEqual(api.calls[0].params, [12]);
  });

  it('impide que ADOPTANTE consulte la solicitud de otra persona', async () => {
    api.queueResults({ rows: [solicitud({ usuario_id: 8 })] });

    const res = await api.request('GET', '/api/solicitudes/12', undefined, bearer(tokenFor()));

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'Insufficient permissions');
  });

  it('devuelve 404 al consultar una solicitud inexistente', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request('GET', '/api/solicitudes/999', undefined, bearer(tokenFor()));

    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Solicitud not found');
  });

  it('permite al publicador aprobar la solicitud y marca la mascota como adoptada', async () => {
    api.queueResults(
      { rows: [solicitud()] },
      { rows: [{ id: 3, creado_por: 1 }] },
      { rows: [solicitud({ estado: 'APROBADA' })] },
      { rows: [{ id: 3 }] }
    );

    const res = await api.request(
      'PUT',
      '/api/solicitudes/12',
      { estado: 'APROBADA' },
      bearer(tokenFor({ id: 1, rol: 'ADMIN' }))
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.data.estado, 'APROBADA');
    assert.deepEqual(api.calls[2].params, ['APROBADA', 12]);
    assert.match(api.calls[3].text, /UPDATE mascotas SET adoptada/);
    assert.deepEqual(api.calls[3].params, [true, 3]);
  });

  it('impide gestionar solicitudes de mascotas publicadas por otra cuenta', async () => {
    api.queueResults({ rows: [solicitud()] }, { rows: [{ id: 3, creado_por: 2 }] });

    const res = await api.request(
      'PUT',
      '/api/solicitudes/12',
      { estado: 'RECHAZADA' },
      bearer(tokenFor({ id: 1, rol: 'ADMIN' }))
    );

    assert.equal(res.status, 403);
    assert.equal(api.calls.length, 2);
  });

  it('no permite cambiar una solicitud ya resuelta', async () => {
    api.queueResults({ rows: [solicitud({ estado: 'APROBADA' })] }, { rows: [{ id: 3, creado_por: 1 }] });

    const res = await api.request(
      'PUT',
      '/api/solicitudes/12',
      { estado: 'RECHAZADA' },
      bearer(tokenFor({ id: 1, rol: 'ADMIN' }))
    );

    assert.equal(res.status, 400);
    assert.match(res.body.message, /Cannot change request status/);
  });

  it('impide que una cuenta profesional solicite adopciones', async () => {
    const res = await api.request(
      'POST',
      '/api/solicitudes',
      { mascota_id: 3 },
      bearer(tokenFor({ id: 1, rol: 'ADMIN' }))
    );

    assert.equal(res.status, 403);
    assert.equal(api.calls.length, 0);
  });

  it('impide que ADOPTANTE modifique el estado de una solicitud', async () => {
    const res = await api.request(
      'PUT',
      '/api/solicitudes/12',
      { estado: 'APROBADA' },
      bearer(tokenFor())
    );

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'Insufficient permissions');
    assert.equal(api.calls.length, 0);
  });

  it('devuelve 404 al modificar una solicitud inexistente', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request(
      'PUT',
      '/api/solicitudes/999',
      { estado: 'RECHAZADA' },
      bearer(tokenFor({ id: 1, rol: 'ADMIN' }))
    );

    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Solicitud not found');
  });
});
