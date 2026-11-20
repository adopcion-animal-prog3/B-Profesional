const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { tokenFor, bearer } = require('../helpers/auth');
const { useTestApp } = require('../helpers/testApp');
const { buildConversaciones } = require('../../src/services/mensajes.service');

const refugio = bearer(tokenFor({ id: 1, rol: 'ADMIN' }));
const mensaje = (overrides = {}) => ({
  id: 1,
  remitente_id: 7,
  destinatario_id: 1,
  mascota_id: 3,
  contenido: 'Hola',
  leido: false,
  created_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('buildConversaciones', () => {
  it('agrupa por la otra cuenta, cuenta no leídos y ordena por el último mensaje', () => {
    const usuarios = new Map([['7', { id: 7, nombre: 'Ana' }], ['8', { id: 8, nombre: 'Beto' }]]);
    const lista = [
      mensaje({ id: 1 }),
      mensaje({ id: 2, remitente_id: 1, destinatario_id: 7, leido: true }),
      mensaje({ id: 3, remitente_id: 8 }),
      mensaje({ id: 4, remitente_id: 7 }),
    ];

    const result = buildConversaciones(lista, 1, usuarios);

    assert.deepEqual(result.map((item) => item.usuario.nombre), ['Ana', 'Beto']);
    assert.equal(result[0].ultimo_mensaje.id, 4);
    assert.equal(result[0].no_leidos, 2);
    assert.equal(result[1].no_leidos, 1);
  });
});

describe('API de mensajes', () => {
  const api = useTestApp();

  it('exige autenticación', async () => {
    const res = await api.request('GET', '/api/mensajes/conversaciones');

    assert.equal(res.status, 401);
  });

  it('lista las conversaciones del usuario autenticado', async () => {
    api.queueResults(
      { rows: [] },
      { rows: [mensaje()] },
      { rows: [{ id: 7, nombre: 'Ana', rol: 'ADOPTANTE' }] }
    );

    const res = await api.request('GET', '/api/mensajes/conversaciones', undefined, refugio);

    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
    assert.deepEqual(res.body.data[0].usuario, { id: 7, nombre: 'Ana', rol: 'ADOPTANTE' });
    assert.deepEqual(api.calls[0].params, [1]);
  });

  it('devuelve la conversación ordenada con la otra cuenta', async () => {
    api.queueResults(
      { rows: [{ id: 7, nombre: 'Ana', rol: 'ADOPTANTE' }] },
      { rows: [mensaje({ id: 5, remitente_id: 1, destinatario_id: 7 })] },
      { rows: [mensaje({ id: 2 })] }
    );

    const res = await api.request('GET', '/api/mensajes/conversaciones/7', undefined, refugio);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.usuario.nombre, 'Ana');
    assert.deepEqual(res.body.data.mensajes.map((item) => item.id), [2, 5]);
  });

  it('devuelve 404 si la otra cuenta no existe', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request('GET', '/api/mensajes/conversaciones/99', undefined, refugio);

    assert.equal(res.status, 404);
  });

  it('marca como leídos los mensajes recibidos de una cuenta', async () => {
    api.queueResults({ rows: [{ id: 7, nombre: 'Ana', rol: 'ADOPTANTE' }] }, { rows: [{ id: 1 }, { id: 4 }] });

    const res = await api.request('PUT', '/api/mensajes/conversaciones/7/leidos', undefined, refugio);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.actualizados, 2);
    assert.deepEqual(api.calls[1].params, [true, 7, 1]);
  });

  it('envía un mensaje con el remitente tomado del token', async () => {
    api.queueResults(
      { rows: [{ id: 7, nombre: 'Ana', rol: 'ADOPTANTE' }] },
      { rows: [{ id: 3 }] },
      { rows: [mensaje({ id: 9, remitente_id: 1, destinatario_id: 7 })] }
    );

    const res = await api.request('POST', '/api/mensajes',
      { destinatario_id: 7, mascota_id: 3, contenido: '  ¿Seguís interesada?  ', remitente_id: 99 }, refugio);

    assert.equal(res.status, 201);
    assert.deepEqual(api.calls[2].params, [1, 7, 3, '¿Seguís interesada?', false]);
  });

  const invalid = {
    'sin destinatario': { contenido: 'Hola' },
    'a sí mismo': { destinatario_id: 1, contenido: 'Hola' },
    'contenido vacío': { destinatario_id: 7, contenido: '   ' },
    'contenido demasiado largo': { destinatario_id: 7, contenido: 'a'.repeat(2001) },
    'mascota inválida': { destinatario_id: 7, mascota_id: 'x', contenido: 'Hola' },
  };

  for (const [name, body] of Object.entries(invalid)) {
    it(`devuelve 400 sin consultar la BD: ${name}`, async () => {
      const res = await api.request('POST', '/api/mensajes', body, refugio);

      assert.equal(res.status, 400);
      assert.equal(api.calls.length, 0);
    });
  }

  it('devuelve 404 si el destinatario no existe', async () => {
    api.queueResults({ rows: [] });

    const res = await api.request('POST', '/api/mensajes', { destinatario_id: 50, contenido: 'Hola' }, refugio);

    assert.equal(res.status, 404);
  });
});
