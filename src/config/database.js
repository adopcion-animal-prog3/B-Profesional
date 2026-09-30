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

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
