const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useMemoryApp } = require('../helpers/memoryApp');

const { request, login, tokenFor, lastCodeFor } = useMemoryApp();

describe('mensajes entre cuentas (base en memoria)', () => {
  it('adoptante y publicador conversan y se marcan los leídos', async () => {
    const refugio = await login('admin@adopcion.test');
    const adoptante = await tokenFor('adoptante@adopcion.test');
    const pets = await request('GET', '/api/mascotas');
    const pet = pets.body.data[0];

    const enviado = await request('POST', '/api/mensajes', {
      token: adoptante,
      body: { destinatario_id: pet.creado_por, mascota_id: pet.id, contenido: '¿Puedo conocer a la mascota?' },
    });
    assert.equal(enviado.status, 201);
    const adoptanteId = enviado.body.data.remitente_id;

    const bandeja = await request('GET', '/api/mensajes/conversaciones', { token: refugio });
    const conversacion = bandeja.body.data.find((item) => item.usuario.id === adoptanteId);
    assert.equal(conversacion.no_leidos, 1);

    const respuesta = await request('POST', '/api/mensajes', {
      token: refugio,
      body: { destinatario_id: adoptanteId, contenido: 'Sí, coordinemos una visita.' },
    });
    assert.equal(respuesta.status, 201);

    const hilo = await request('GET', `/api/mensajes/conversaciones/${adoptanteId}`, { token: refugio });
    assert.deepEqual(hilo.body.data.mensajes.map((item) => item.contenido), [
      '¿Puedo conocer a la mascota?',
      'Sí, coordinemos una visita.',
    ]);

    const leidos = await request('PUT', `/api/mensajes/conversaciones/${adoptanteId}/leidos`, { token: refugio });
    assert.equal(leidos.body.data.actualizados, 1);

    const despues = await request('GET', '/api/mensajes/conversaciones', { token: refugio });
    assert.equal(despues.body.data.find((item) => item.usuario.id === adoptanteId).no_leidos, 0);
  });

  it('un registro nuevo crea una cuenta profesional que puede publicar', async () => {
    const registro = await request('POST', '/api/auth/register', {
      body: { nombre: 'Refugio Norte', email: 'norte@adopcion.test', password: 'clave-segura' },
    });
    assert.equal(registro.status, 201);
    assert.equal(registro.body.data.rol, 'ADMIN');

    const verificado = await request('POST', '/api/auth/verify', {
      body: { email: 'norte@adopcion.test', codigo: lastCodeFor('norte@adopcion.test') },
    });
    assert.equal(verificado.status, 200);
    const token = await login('norte@adopcion.test', 'clave-segura');
    const creada = await request('POST', '/api/mascotas', {
      token,
      body: { nombre: 'Toby', especie: 'Perro', imagen: 'data:image/png;base64,iVBORw0KGgo=' },
    });
    assert.equal(creada.status, 201);
    assert.equal(creada.body.data.creado_por, registro.body.data.id);
    assert.match(creada.body.data.imagen, /^data:image\/png/);
  });
});
