require('dotenv').config();

const { initDatabase, getDatabaseInfo } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function start() {
  await initDatabase();
  const info = getDatabaseInfo();
  logger.info(`[db] Modo: ${info.mode}`);

  const { app } = require('../src/server');
  const port = Number(process.env.PORT) || 3000;

  const server = app.listen(port, () => {
    logger.info(`API de adopciones escuchando en http://localhost:${port}`);
    logger.info('Usuario demo: admin@adopcion.test / Demo1234!');
  });

  server.on('error', (error) => {
    logger.error(`No se pudo iniciar el servidor: ${error.message}`);
    process.exitCode = 1;
  });

  return server;
}

start().catch((error) => {
  logger.error(`Error al iniciar: ${error.message}`);
  process.exitCode = 1;
});
