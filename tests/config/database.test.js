const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Este archivo corre en su propio proceso: se fuerza el modo PostgreSQL con
// una URL a un puerto cerrado para verificar el manejo del error de conexión.
process.env.DB_MODE = 'postgres';
process.env.DATABASE_URL = 'postgres://usuario:clave@127.0.0.1:1/inexistente';

const database = require('../../src/config/database');
const { seedDatabase } = require('../../src/config/seed');

describe('configuración de la base de datos', () => {
  it('propaga el error cuando PostgreSQL no está disponible', async () => {
    await assert.rejects(database.initDatabase());
    await assert.rejects(database.query('SELECT 1'));
  });

  it('expone información del modo y un cierre seguro', async () => {
    assert.equal(database.getDatabaseInfo().seeded, true);
    await database.closeDatabase();
  });

  it('el seed no vuelve a cargar datos si ya hay usuarios', async () => {
    const calls = [];
    const result = await seedDatabase(async (text) => {
      calls.push(text);
      return { rows: [{ count: 3 }] };
    });

    assert.deepEqual(result, { seeded: false });
    assert.equal(calls.length, 1);
  });
});
