const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { useTestApp } = require('../helpers/testApp');
const { mascotaRow, validMascotaPayload } = require('../helpers/fixtures');

describe('POST /api/mascotas', () => {
  const api = useTestApp();

  it('crea la mascota y devuelve 201 con INSERT parametrizado', async () => {
    api.queueResults({ rows: [mascotaRow({ id: 10 })] });

    const res = await api.request('POST', '/api/mascotas', validMascotaPayload());

    assert.equal(res.status, 201);
    assert.equal(res.body.data.id, 10);
    assert.match(api.calls[0].text, /VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8\)/);
    assert.deepEqual(api.calls[0].params.slice(0, 2), ['Luna', 'Perro']);
  });

  it('aplica valores por defecto: opcionales en null y adoptada=false', async () => {
    api.queueResults({ rows: [mascotaRow()] });

    await api.request('POST', '/api/mascotas', { nombre: 'Max', especie: 'Perro' });

    assert.deepEqual(api.calls[0].params, ['Max', 'Perro', null, null, null, null, false, null]);
  });

  it('no inyecta datos del usuario en el texto SQL', async () => {
    api.queueResults({ rows: [mascotaRow()] });
    const hostile = "x'); DROP TABLE mascotas; --";

    await api.request('POST', '/api/mascotas', validMascotaPayload({ nombre: hostile }));

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
    'creado_por invalido': { creado_por: 0 },
  };

  for (const [name, overrides] of Object.entries(invalidCases)) {
    it(`devuelve 400 y no inserta: ${name}`, async () => {
      const res = await api.request('POST', '/api/mascotas', validMascotaPayload(overrides));

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(api.calls.length, 0);
    });
  }

  it('devuelve 400 si el cuerpo es un arreglo', async () => {
    const res = await api.request('POST', '/api/mascotas', []);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Request body is required');
  });

  it('traduce un error de clave foranea de la BD a 400', async () => {
    api.queueResults(Object.assign(new Error('fk'), { code: '23503' }));

    const res = await api.request('POST', '/api/mascotas', validMascotaPayload({ creado_por: 999 }));

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Invalid data');
  });
});
