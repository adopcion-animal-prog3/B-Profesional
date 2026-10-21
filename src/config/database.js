const { Pool } = require('pg');
require('dotenv').config();

const config = {
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'adopcion_db',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || '',
};

const pool = new Pool(config);

// Evita que un error de cliente inactivo termine el proceso y que la
// comprobacion de salud pueda responder 503 en lugar de caer.
pool.on('error', (error) => {
  console.error('Error del pool de PostgreSQL:', error.code || 'UNKNOWN_ERROR');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
