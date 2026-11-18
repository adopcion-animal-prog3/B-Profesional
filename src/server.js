const express = require('express');
const cors = require('cors');

const { port } = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const healthRoutes = require('./routes/health.routes');
const dbRoutes = require('./routes/db.routes');
const mascotasRoutes = require('./routes/mascotas.routes');
const authRoutes = require('./routes/auth.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');
const historialRoutes = require('./routes/historial.routes');
const mensajesRoutes = require('./routes/mensajes.routes');
const swaggerUiRoutes = require('./docs/swagger-ui');

const app = express();

app.use(cors());
// Límite ampliado para admitir la imagen de la mascota (data URL base64).
app.use(express.json({ limit: '5mb' }));

app.use(healthRoutes);
app.use(dbRoutes);
app.use(mascotasRoutes);
app.use(authRoutes);
app.use(historialRoutes);
app.use(solicitudesRoutes);
app.use(mensajesRoutes);
app.use(swaggerUiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// Solo escucha cuando se ejecuta directamente (node src/server.js); los tests importan `app`.
const server = require.main === module ? app.listen(port, () => {}) : null;

module.exports = { app, server };
