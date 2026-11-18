const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useMemoryApp } = require('../helpers/memoryApp');

const { request, login, tokenFor } = useMemoryApp();

describe('integración con la base en memoria', () => {
  it('responde salud, verificación de base y documentación', async () => {
    assert.equal((await request('GET', '/health')).status, 200);
    assert.equal((await request('GET', '/api/db-check')).status, 200);

    const spec = await request('GET', '/api-docs.json');
    assert.equal(spec.status, 200);
    assert.equal(spec.body.openapi, '3.0.3');

    const docs = await request('GET', '/api-docs');
    assert.equal(docs.status, 200);
    assert.match(docs.body, /swagger-ui/);
  });

  it('inicia sesión con los usuarios sembrados y rechaza credenciales inválidas', async () => {
    assert.ok(await login('admin@adopcion.test'));
    const adoptante = await request('POST', '/api/auth/login', {
      body: { email: 'adoptante@adopcion.test', password: 'Demo1234!' },
    });
    assert.equal(adoptante.status, 403);

    const bad = await request('POST', '/api/auth/login', {
      body: { email: 'admin@adopcion.test', password: 'incorrecta' },
    });
    assert.equal(bad.status, 401);
  });

  it('lista las mascotas sembradas', async () => {
    const res = await request('GET', '/api/mascotas');

    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 6);
    assert.ok(res.body.data.some((pet) => pet.nombre === 'Luna'));
  });

  it('recorre el ciclo de vida de una mascota y su historial clínico', async () => {
    const admin = await login('admin@adopcion.test');

    const created = await request('POST', '/api/mascotas', {
      token: admin,
      body: { nombre: 'Integración', especie: 'Gato', edad: 3, sexo: 'M', descripcion: 'Creada por test' },
    });
    assert.equal(created.status, 201);
    const petId = created.body.data.id;

    const detail = await request('GET', `/api/mascotas/${petId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.nombre, 'Integración');

    const updated = await request('PUT', `/api/mascotas/${petId}`, { token: admin, body: { raza: 'Persa' } });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.raza, 'Persa');

    const record = await request('POST', `/api/mascotas/${petId}/historial`, {
      token: admin,
      body: { descripcion: 'Control general', veterinario: 'Dra. Test' },
    });
    assert.equal(record.status, 201);
    const recordId = record.body.data.id;

    const history = await request('GET', `/api/mascotas/${petId}/historial`, { token: admin });
    assert.equal(history.status, 200);
    assert.ok(history.body.data.some((item) => item.id === recordId));

    const recordUpdate = await request('PUT', `/api/historial/${recordId}`, {
      token: admin,
      body: { descripcion: 'Control revisado' },
    });
    assert.equal(recordUpdate.status, 200);

    assert.equal((await request('DELETE', `/api/historial/${recordId}`, { token: admin })).status, 200);
    assert.equal((await request('DELETE', `/api/mascotas/${petId}`, { token: admin })).status, 200);
    assert.equal((await request('GET', `/api/mascotas/${petId}`)).status, 404);
  });

  it('crea, consulta y aprueba una solicitud de adopción', async () => {
    const admin = await login('admin@adopcion.test');
    const adoptante = await tokenFor('adoptante@adopcion.test');
    const pets = await request('GET', '/api/mascotas');
    const target = pets.body.data.find((pet) => !pet.adoptada);

    const created = await request('POST', '/api/solicitudes', {
      token: adoptante,
      body: { mascota_id: target.id, mensaje: 'Quiero adoptarla' },
    });
    assert.equal(created.status, 201);
    const solicitudId = created.body.data.id;

    const mine = await request('GET', '/api/solicitudes', { token: adoptante });
    assert.equal(mine.status, 200);
    assert.ok(mine.body.data.some((item) => item.id === solicitudId));

    const all = await request('GET', '/api/solicitudes', { token: admin });
    assert.equal(all.status, 200);

    const detail = await request('GET', `/api/solicitudes/${solicitudId}`, { token: adoptante });
    assert.equal(detail.status, 200);

    const approved = await request('PUT', `/api/solicitudes/${solicitudId}`, {
      token: admin,
      body: { estado: 'APROBADA' },
    });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.estado, 'APROBADA');

    const forbidden = await request('PUT', `/api/solicitudes/${solicitudId}`, {
      token: adoptante,
      body: { estado: 'RECHAZADA' },
    });
    assert.equal(forbidden.status, 403);
  });
});
