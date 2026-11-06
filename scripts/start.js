require('dotenv').config();

const { app } = require('../src/server');
const { port } = require('../src/config/env');
const logger = require('../src/utils/logger');

const server = app.listen(port, () => {
  logger.info(`API de adopciones escuchando en http://localhost:${port}`);
});

server.on('error', (error) => {
  logger.error(`No se pudo iniciar el servidor: ${error.message}`);
  process.exitCode = 1;
});
