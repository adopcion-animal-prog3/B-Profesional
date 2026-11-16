const { beforeEach, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const memoryDb = require('../../src/config/memory-db');

const pets = [
  { id: 1, nombre: 'Luna', especie: 'Perro', adoptada: false },
  { id: 2, nombre: 'Simón', especie: 'Gato', adoptada: true },
  { id: 3, nombre: 'Lola', especie: 'Perro', adoptada: false },
];

describe('motor de base de datos en memoria', () => {
  beforeEach(() => {
    memoryDb.reset();
    memoryDb.seed('mascotas', pets);
  });

  it('responde las consultas de salud', async () => {
    assert.deepEqual((await memoryDb.query('SELECT 1')).rows, [{ ok: 1 }]);
    const health = await memoryDb.query('SELECT 1 AS ok, NOW() AS current_time');
    assert.equal(health.rows[0].ok, 1);
  });

  it('cuenta filas y busca por id con proyección de columnas', async () => {
    const count = await memoryDb.query('SELECT COUNT(*) AS total FROM mascotas');
    assert.equal(count.rows[0].total, 3);

    const byId = await memoryDb.query('SELECT id, nombre AS name FROM mascotas WHERE id = $1', [2]);
    assert.deepEqual(byId.rows, [{ id: 2, name: 'Simón' }]);

    const missing = await memoryDb.query('SELECT id FROM mascotas WHERE id = $1', [99]);
    assert.equal(missing.rowCount, 0);
  });

  it('filtra con AND, LIKE, LOWER y NOT, y ordena', async () => {
    const perros = await memoryDb.query(
      'SELECT * FROM mascotas WHERE especie = $1 AND adoptada = $2 ORDER BY nombre ASC',
      ['Perro', false]
    );
    assert.deepEqual(perros.rows.map((pet) => pet.nombre), ['Lola', 'Luna']);

    const desc = await memoryDb.query('SELECT nombre FROM mascotas WHERE especie = $1 ORDER BY id DESC', ['Perro']);
    assert.deepEqual(desc.rows.map((pet) => pet.nombre), ['Lola', 'Luna']);

    const like = await memoryDb.query('SELECT nombre FROM mascotas WHERE nombre LIKE $1', ['l_%']);
    assert.equal(like.rowCount, 2);

    const lower = await memoryDb.query('SELECT id FROM mascotas WHERE LOWER(nombre) = $1', ['luna']);
    assert.deepEqual(lower.rows, [{ id: 1 }]);

    const negated = await memoryDb.query('SELECT id FROM mascotas WHERE NOT $1', [false]);
    assert.equal(negated.rowCount, 3);

    const all = await memoryDb.query('SELECT nombre FROM mascotas');
    assert.equal(all.rowCount, 3);
  });

  it('inserta resolviendo parámetros y literales', async () => {
    const inserted = await memoryDb.query(
      "INSERT INTO mascotas (nombre, especie, origen) VALUES ($1, 'Conejo', refugio) RETURNING id, especie, origen",
      ['Nube']
    );
    assert.deepEqual(inserted.rows[0], { id: 4, especie: 'Conejo', origen: 'refugio' });

    const simple = await memoryDb.query('INSERT INTO usuarios (nombre) VALUES ($1)', ['Ana']);
    assert.equal(simple.rows[0].nombre, 'Ana');
    assert.ok(simple.rows[0].created_at);
  });

  it('actualiza y elimina devolviendo las filas afectadas', async () => {
    const updated = await memoryDb.query(
      "UPDATE mascotas SET adoptada = $1, estado = 'Adoptado', revisado = NOW() WHERE id = $2 RETURNING id, adoptada, estado",
      [true, 1]
    );
    assert.deepEqual(updated.rows, [{ id: 1, adoptada: true, estado: 'Adoptado' }]);

    const deleted = await memoryDb.query('DELETE FROM mascotas WHERE id = $1 RETURNING id', [3]);
    assert.deepEqual(deleted.rows, [{ id: 3 }]);
    assert.equal((await memoryDb.query('SELECT COUNT(*) AS n FROM mascotas')).rows[0].n, 2);
  });

  it('rechaza consultas que no soporta', async () => {
    await assert.rejects(memoryDb.query('TRUNCATE mascotas'), /no soportado/);
    await assert.rejects(memoryDb.query('SELECT'), /SELECT no soportado/);
    await assert.rejects(memoryDb.query('INSERT INTO mascotas'), /INSERT no soportado/);
    await assert.rejects(memoryDb.query('UPDATE mascotas SET a = 1'), /UPDATE no soportado/);
    await assert.rejects(memoryDb.query('DELETE FROM mascotas'), /DELETE no soportado/);
  });
});
