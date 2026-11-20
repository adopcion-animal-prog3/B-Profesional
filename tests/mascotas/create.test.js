const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useTestApp } = require('../helpers/testApp');
const { mascotaRow, validMascotaPayload } = require('../helpers/fixtures');
const { tokenFor, bearer } = require('../helpers/auth');

const admin = bearer(tokenFor({ id: 1, rol: 'ADMIN' }));
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('POST /api/mascotas', () => {
  const api = useTestApp();

  it('crea la mascota y devuelve 201 con INSERT parametrizado', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 10 })] });

    const res = await api.request('POST', '/api/mascotas', validMascotaPayload(), admin);

    assert.equal(res.status, 201);
    assert.equal(res.body.data.id, 10);
    assert.match(api.calls[0].text, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9\)/);
    assert.deepEqual(api.calls[0].params.slice(0, 2), ['Luna', 'Perro']);
  });

  it('aplica valores por defecto: opcionales en null y adoptada=false', async () => {
    api.queueResults({ rows: [mascotaRow()] });

    await api.request('POST', '/api/mascotas', { nombre: 'Max', especie: 'Perro' }, admin);

    assert.deepEqual(api.calls[0].params, ['Max', 'Perro', null, null, null, null, false, 1, null]);
  });

  it('no inyecta datos del usuario en el texto SQL', async () => {
    api.queueResults({ rows: [mascotaRow()] });
    const hostile = "x'); DROP TABLE mascotas; --";

    await api.request('POST', '/api/mascotas', validMascotaPayload({ nombre: hostile }), admin);

    assert.doesNotMatch(api.calls[0].text, /DROP TABLE/);
    assert.equal(api.calls[0].params[0], hostile);
  });

  const invalidCases = {
    'nombre ausente': { nombre: undefined },
    'nombre vacio': { nombre: '   ' },
    'nombre demasiado largo': { nombre: 'a'.repeat(151) },
    'especie ausente': { especie: undefined },
    'edad negativa': { edad: -1 },
    'edad no entera': { edad: 1.5 },
    'sexo fuera de la lista': { sexo: 'X' },
    'adoptada no booleana': { adoptada: 'si' },
    'raza no string': { raza: 123 },
    'raza demasiado larga': { raza: 'r'.repeat(121) },
    'descripcion no string': { descripcion: 42 },
    'imagen que no es data URL': { imagen: 'http://example.com/a.png' },
    'imagen de tipo no permitido': { imagen: 'data:text/html;base64,PGI+' },
  };

  for (const [name, overrides] of Object.entries(invalidCases)) {
    it(`devuelve 400 y no inserta: ${name}`, async () => {
      const res = await api.request('POST', '/api/mascotas', validMascotaPayload(overrides), admin);

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(api.calls.length, 0);
    });
  }

  it('devuelve 400 si el cuerpo es un arreglo', async () => {
    const res = await api.request('POST', '/api/mascotas', [], admin);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Request body is required');
  });

  it('traduce un error de clave foranea de la BD a 400', async () => {
    api.queueResults(Object.assign(new Error('fk'), { code: '23503' }));

    const res = await api.request('POST', '/api/mascotas', validMascotaPayload({ creado_por: 999 }), admin);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid data');
  });

  it('asigna como publicador al usuario del token aunque el cuerpo diga otro', async () => {
    api.queueResults({ rows: [mascotaRow()] });

    await api.request('POST', '/api/mascotas', validMascotaPayload({ creado_por: 99 }), admin);

    assert.equal(api.calls[0].params[7], 1);
  });

  it('guarda la imagen enviada como data URL', async () => {
    api.queueResults({ rows: [mascotaRow({ imagen: PNG })] });

    const res = await api.request('POST', '/api/mascotas', validMascotaPayload({ imagen: PNG }), admin);

    assert.equal(res.status, 201);
    assert.equal(api.calls[0].params[8], PNG);
  });

  it('exige autenticación para publicar', async () => {
    const res = await api.request('POST', '/api/mascotas', validMascotaPayload());

    assert.equal(res.status, 401);
    assert.equal(api.calls.length, 0);
  });

  it('impide publicar a una cuenta de adoptante', async () => {
    const res = await api.request('POST', '/api/mascotas', validMascotaPayload(), bearer(tokenFor()));

    assert.equal(res.status, 403);
    assert.equal(api.calls.length, 0);
  });
});
