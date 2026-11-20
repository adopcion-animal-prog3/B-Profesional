const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logger = require('../utils/logger');
const memoryDb = require('./memory-db');
const { seedDatabase } = require('./seed');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'init.sql');
const INT8_OID = 20;

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
        const { Pool, types } = require('pg');
        // BIGSERIAL (int8) se devuelve como número para respetar el contrato (ids enteros).
        types.setTypeParser(INT8_OID, (value) => Number.parseInt(value, 10));
        pool = new Pool({ connectionString: DATABASE_URL });
        mode = 'postgres';
        await pool.query('SELECT 1');
        // El esquema compartido es idempotente: crea tablas y columnas nuevas si faltan.
        await pool.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));
        logger.info('[db] Conectado a PostgreSQL externo y esquema verificado.');
      } else {
        pool = memoryDb;
        mode = 'memory';
        logger.info('[db] Base de datos en memoria inicializada.');
      }

      // La plataforma arranca vacía; los datos demo solo se cargan si se piden explícitamente.
      if (process.env.SEED_DEMO_DATA === 'true') {
        const seeded = await seedDatabase((text, params) => pool.query(text, params));
        if (seeded.seeded) logger.info('[db] Datos de demostración cargados.');
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
