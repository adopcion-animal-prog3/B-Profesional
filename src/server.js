const express = require('express');
const cors = require('cors');

const { port } = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const healthRoutes = require('./routes/health.routes');
const dbRoutes = require('./routes/db.routes');
const mascotasRoutes = require('./routes/mascotas.routes');
const authRoutes = require('./routes/auth.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');
const swaggerUiRoutes = require('./docs/swagger-ui');

const app = express();

app.use(cors());
app.use(express.json());

app.use(healthRoutes);
app.use(dbRoutes);
app.use(mascotasRoutes);
app.use(authRoutes);
app.use(solicitudesRoutes);
app.use(swaggerUiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(port, () => {});

module.exports = { app, server };
