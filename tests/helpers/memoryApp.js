// Arnés de integración: levanta la app Express con la base EN MEMORIA real
// (src/config/memory-db.js + seed.js), sin reemplazar la capa de datos.
// Así se verifica el recorrido completo ruta -> SQL parametrizado -> datos.
const { before, after } = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-tests-only-secret';
process.env.DB_MODE = 'memory';

const { initDatabase } = require('../../src/config/database');
const { DEMO_PASSWORD } = require('../../src/config/seed');
const { app } = require('../../src/server');

function useMemoryApp() {
  const context = { baseUrl: '' };
  let server;

  before(async () => {
    await initDatabase();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    context.baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  const request = async (method, path, { token, body } = {}) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${context.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let payload = text;
    try {
      payload = JSON.parse(text);
    } catch {
      /* respuesta no JSON (por ejemplo, HTML de la documentación) */
    }
    return { status: response.status, body: payload };
  };

  const login = async (email) => {
    const res = await request('POST', '/api/auth/login', { body: { email, password: DEMO_PASSWORD } });
    return res.body?.data?.token;
  };

  return { request, login };
}

module.exports = { useMemoryApp };
