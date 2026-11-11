const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = require('../utils/logger');
const memoryDb = require('./memory-db');
const { seedDatabase } = require('./seed');

const DATABASE_URL = process.env.DATABASE_URL;
const DB_MODE = String(process.env.DB_MODE || 'memory').toLowerCase();

let pool = null;
let mode = 'memory';
let initPromise = null;

async function initDatabase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (DATABASE_URL && DB_MODE !== 'memory') {
        const { Pool } = require('pg');
        pool = new Pool({ connectionString: DATABASE_URL });
        mode = 'postgres';
        await pool.query('SELECT 1');
        logger.info('[db] Conectado a PostgreSQL externo.');
      } else {
        pool = memoryDb;
        mode = 'memory';
        logger.info('[db] Base de datos en memoria inicializada.');
      }

      // Ejecutar seed si la tabla usuarios está vacía
      const countResult = await pool.query('SELECT COUNT(*) AS count FROM usuarios');
      const count = Number(countResult.rows[0]?.count || 0);
      if (count === 0) {
        await seedDatabase((text, params) => pool.query(text, params));
        logger.info('[db] Datos de demostración cargados. Usuario admin: admin@adopcion.test');
      }
    } catch (error) {
      logger.error(`[db] Error inicializando la base de datos: ${error.message}`);
      throw error;
    }
  })();

  return initPromise;
}

async function query(text, params) {
  await initDatabase();
  const sql = text.replace(/\s+/g, ' ').trim();
  return pool.query(sql, params);
}

function getDatabaseInfo() {
  return { mode, seeded: true };
}

function closeDatabase() {
  return Promise.resolve();
}

module.exports = {
  query,
  pool,
  getDatabaseInfo,
  closeDatabase,
  initDatabase,
  mode,
  memoryDb,
};

// Auto-inicializar cuando se importa
initDatabase().catch(() => {
  /* El error ya se loguea dentro de initDatabase */
});
