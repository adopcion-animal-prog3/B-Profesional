// Arnés de integración: levanta la app Express con la base EN MEMORIA real
// (src/config/memory-db.js + seed.js), sin reemplazar la capa de datos.
// Así se verifica el recorrido completo ruta -> SQL parametrizado -> datos.
const { before, after } = require('node:test');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-tests-only-secret';
process.env.DB_MODE = 'memory';
process.env.SEED_DEMO_DATA = 'true';
process.env.MAIL_MODE = 'memory';

const jwt = require('jsonwebtoken');
const { initDatabase, query } = require('../../src/config/database');
const { DEMO_PASSWORD } = require('../../src/config/seed');
const { app } = require('../../src/server');
const { outbox } = require('../../src/services/mailer.service');

// Extrae el código de 6 dígitos del último correo enviado a `email`.
const lastCodeFor = (email) => {
  const mail = [...outbox].reverse().find((item) => item.to.toLowerCase() === email.toLowerCase());
  return mail?.text.match(/\b(\d{6})\b/)?.[1];
};

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

  // Login completo en dos pasos: contraseña -> código recibido por email -> token.
  const login = async (email, password = DEMO_PASSWORD) => {
    const first = await request('POST', '/api/auth/login', { body: { email, password } });
    if (first.status !== 202) return undefined;
    const res = await request('POST', '/api/auth/verify', { body: { email, codigo: lastCodeFor(email) } });
    return res.body?.data?.token;
  };

  // Las cuentas ADOPTANTE no inician sesión en este portal: se firma su token directamente.
  const tokenFor = async (email) => {
    const result = await query('SELECT id, email, rol FROM usuarios WHERE LOWER(email) = $1', [email]);
    const { id, rol } = result.rows[0];
    return jwt.sign({ id, email, rol }, process.env.JWT_SECRET, { subject: String(id), algorithm: 'HS256' });
  };

  return { request, login, tokenFor, lastCodeFor };
}

module.exports = { useMemoryApp };
