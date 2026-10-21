const { query } = require('../config/database');

const DB_PROBE_TIMEOUT_MS = 2000;
const DB_PROBE_SQL = 'SELECT 1 AS ok, NOW() AS current_time';

const settle = (promise) =>
  promise.then(
    (value) => ({ ok: true, value }),
    (error) => ({ ok: false, error })
  );

const withTimeout = async (promise, timeoutMs) => {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, error: new Error('Health check timeout') }), timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
  });

  const outcome = await Promise.race([settle(promise), timeout]);
  clearTimeout(timer);
  return outcome;
};

const checkProcessHealth = () => ({ status: 'ok' });

const checkDatabaseHealth = async () => {
  let outcome;
  try {
    outcome = await withTimeout(query(DB_PROBE_SQL), DB_PROBE_TIMEOUT_MS);
  } catch (error) {
    outcome = { ok: false, error };
  }

  if (!outcome.ok) {
    console.error('Health check de PostgreSQL fallo:', outcome.error?.code || 'UNKNOWN_ERROR');
    return { available: false, databaseTime: null };
  }

  return { available: true, databaseTime: outcome.value.rows[0]?.current_time ?? null };
};

module.exports = {
  checkProcessHealth,
  checkDatabaseHealth,
};
