const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { useMemoryApp } = require('../helpers/memoryApp');

const { request, login } = useMemoryApp();

describe('validaciones de historial clínico y solicitudes (base en memoria)', () => {
  let admin;
  let adoptante;

  before(async () => {
    admin = await login('admin@adopcion.test');
    adoptante = await login('adoptante@adopcion.test');
  });

  it('rechaza IDs inválidos y recursos inexistentes en el historial', async () => {
    const cases = [
      ['GET', '/api/mascotas/abc/historial', undefined, 400],
      ['GET', '/api/mascotas/9999/historial', undefined, 404],
      ['POST', '/api/mascotas/0/historial', { descripcion: 'x' }, 400],
      ['POST', '/api/mascotas/9999/historial', { descripcion: 'Control' }, 404],
      ['PUT', '/api/historial/-1', { descripcion: 'x' }, 400],
      ['PUT', '/api/historial/9999', { descripcion: 'Control' }, 404],
      ['DELETE', '/api/historial/abc', undefined, 400],
      ['DELETE', '/api/historial/9999', undefined, 404],
    ];

    for (const [method, path, body, expected] of cases) {
      const res = await request(method, path, { token: admin, body });
      assert.equal(res.status, expected, `${method} ${path}`);
    }
  });

  it('valida el cuerpo al crear y editar registros clínicos', async () => {
    const pets = await request('GET', '/api/mascotas');
    const petId = pets.body.data[0].id;
    const invalidBodies = [
      { descripcion: '   ' },
      { descripcion: 'Control', veterinario: 5 },
      { descripcion: 'Control', veterinario: 'x'.repeat(201) },
    ];

    for (const body of invalidBodies) {
      const res = await request('POST', `/api/mascotas/${petId}/historial`, { token: admin, body });
      assert.equal(res.status, 400);
    }

    const created = await request('POST', `/api/mascotas/${petId}/historial`, {
      token: admin,
      body: { descripcion: 'Vacuna', veterinario: null },
    });
    const recordId = created.body.data.id;

    const invalidUpdates = [
      { mascota_id: 2 },
      { fecha_registro: '' },
      { fecha_registro: 'no-es-fecha' },
      { descripcion: '' },
      { veterinario: 10 },
    ];
    for (const body of invalidUpdates) {
      const res = await request('PUT', `/api/historial/${recordId}`, { token: admin, body });
      assert.equal(res.status, 400, JSON.stringify(body));
    }

    const unchanged = await request('PUT', `/api/historial/${recordId}`, { token: admin, body: {} });
    assert.equal(unchanged.status, 200);

    const full = await request('PUT', `/api/historial/${recordId}`, {
      token: admin,
      body: { fecha_registro: '2026-05-01T10:00:00.000Z', veterinario: ' Dr. Gil ' },
    });
    assert.equal(full.status, 200);
    assert.equal(full.body.data.veterinario, 'Dr. Gil');
  });

  it('valida las solicitudes de adopción', async () => {
    const pets = await request('GET', '/api/mascotas');
    const adoptada = pets.body.data.find((pet) => pet.adoptada);

    const invalid = [
      [{ mascota_id: 'x' }, 400],
      [{ mascota_id: 1, mensaje: 3 }, 400],
      [{ mascota_id: 9999 }, 404],
      [{ mascota_id: adoptada.id }, 400],
    ];
    for (const [body, expected] of invalid) {
      const res = await request('POST', '/api/solicitudes', { token: adoptante, body });
      assert.equal(res.status, expected, JSON.stringify(body));
    }

    assert.equal((await request('GET', '/api/solicitudes/abc', { token: admin })).status, 400);
    assert.equal((await request('GET', '/api/solicitudes/9999', { token: admin })).status, 404);
    assert.equal((await request('PUT', '/api/solicitudes/abc', { token: admin, body: { estado: 'APROBADA' } })).status, 400);
    assert.equal((await request('PUT', '/api/solicitudes/1', { token: admin, body: { estado: 'OTRO' } })).status, 400);
    assert.equal((await request('PUT', '/api/solicitudes/9999', { token: admin, body: { estado: 'APROBADA' } })).status, 404);
  });
});
