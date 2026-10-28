// Arnes de pruebas: levanta la app Express en un puerto efimero y reemplaza
// la capa de base de datos por un doble de prueba. NO usa PostgreSQL real:
// verifica rutas, validaciones, parametros SQL y codigos HTTP, no persistencia.
const { before, after, beforeEach } = require('node:test');

const dbPath = require.resolve('../../src/config/database');
const calls = [];
let responder = async () => ({ rows: [] });

require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (text, params) => {
      calls.push({ text, params });
      return responder(text, params);
    },
    pool: {},
  },
};

const { app } = require('../../src/server');

// Registra los hooks del test runner y devuelve la API del arnes.
function useTestApp() {
  let server;
  let baseUrl;

  before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => new Promise((resolve) => server.close(resolve)));

  beforeEach(() => {
    calls.length = 0;
    responder = async () => ({ rows: [] });
  });

  return {
    calls,
    // Define respuestas de la BD en orden: una por cada query esperada.
    queueResults(...results) {
      const queue = [...results];
      responder = async () => {
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return next || { rows: [] };
      };
    },
    async request(method, path, body) {
      const options = { method, headers: {} };
      if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const response = await fetch(`${baseUrl}${path}`, options);
      return { status: response.status, body: await response.json() };
    },
  };
}

module.exports = { useTestApp };
