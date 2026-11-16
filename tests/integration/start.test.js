const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_MODE = 'memory';
// Puerto alto al azar para no chocar con una API que ya esté corriendo en el 3000.
process.env.PORT = String(40000 + Math.floor(Math.random() * 10000));

const { start } = require('../../scripts/start');

describe('script de arranque', () => {
  it('inicializa la base en memoria y levanta la API', async () => {
    const server = await start();
    await new Promise((resolve) => (server.listening ? resolve() : server.once('listening', resolve)));

    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
      assert.equal(response.status, 200);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
