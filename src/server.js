const express = require('express');
const cors = require('cors');

const { port } = require('./config/env');
const healthRoutes = require('./routes/health.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(healthRoutes);

const server = app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});

module.exports = { app, server };
