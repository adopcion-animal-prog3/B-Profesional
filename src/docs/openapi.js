// Especificación OpenAPI armada con pequeños helpers para no repetir
// las mismas respuestas, parámetros y envoltorios en cada endpoint.
const ref = (path) => ({ $ref: `#/components/${path}` });
const schemaRef = (name) => ref(`schemas/${name}`);
const jsonContent = (schema) => ({ 'application/json': { schema } });
const jsonBody = (schema) => ({ required: true, content: jsonContent(schema) });
const response = (description, schema) => ({ description, content: jsonContent(schema) });
const objectOf = (properties, required) => ({ type: 'object', properties, ...(required && { required }) });

const successStatus = { type: 'string', enum: ['success'] };
const success = (data, extra = {}) => objectOf({ status: successStatus, data, ...extra });
const successMessage = (example, data) =>
  success(objectOf({ message: { type: 'string', example }, ...(data && { data }) }));

const ERROR_REFS = {
  400: 'BadRequest',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  500: 'InternalError',
  503: 'ServiceUnavailable',
};
const errors = (...codes) => Object.fromEntries(codes.map((code) => [code, ref(`responses/${ERROR_REFS[code]}`)]));
const errorResponse = (description) => response(description, schemaRef('ErrorResponse'));

const bearer = [{ bearerAuth: [] }];
const idParam = [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }];
const dateTime = { type: 'string', format: 'date-time', example: '2026-10-16T10:00:00.000Z' };
const nullableString = (example) => ({ type: 'string', nullable: true, ...(example && { example }) });
const sexo = { type: 'string', enum: ['M', 'F', 'OTRO'], nullable: true };
const estadoSolicitud = { type: 'string', enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'] };
const AUTH_ERRORS = [400, 401, 403, 404, 500];

const operation = (tag, summary, responses, extra = {}) => ({ tags: [tag], summary, ...extra, responses });
const securedById = (tag, summary, responses, extra = {}) =>
  operation(tag, summary, responses, { security: bearer, parameters: idParam, ...extra });

const healthData = (properties) =>
  objectOf({
    success: { type: 'boolean', example: true },
    status: successStatus,
    data: objectOf({ status: { type: 'string', enum: ['ok'] }, ...properties }, ['status']),
  }, ['status', 'data']);

const roleCheck = (summary, message) =>
  operation('Auth', summary, {
    200: response('Acceso permitido', successMessage(message)),
    ...errors(401, 403),
  }, { security: bearer });

const schemas = {
  ErrorResponse: objectOf({
    success: { type: 'boolean', example: false },
    status: { type: 'string', enum: ['error'] },
    message: { type: 'string', description: 'Descripción del error' },
    error: objectOf({ message: { type: 'string', description: 'Descripción del error' } }),
  }, ['status', 'message']),
  User: objectOf({
    id: { type: 'integer', example: 1 },
    nombre: { type: 'string', example: 'Ana Gomez' },
    email: { type: 'string', format: 'email', example: 'ana@example.com' },
    rol: { type: 'string', enum: ['ADMIN', 'ADOPTANTE'] },
  }, ['id', 'nombre', 'email', 'rol']),
  Mascota: objectOf({
    id: { type: 'integer', example: 1 },
    nombre: { type: 'string', example: 'Firulais' },
    especie: { type: 'string', example: 'Perro' },
    raza: nullableString('Labrador'),
    edad: { type: 'integer', nullable: true, example: 3 },
    sexo: { ...sexo, example: 'M' },
    descripcion: nullableString('Perro muy sociable'),
    adoptada: { type: 'boolean', example: false },
    creado_por: { type: 'integer', nullable: true, example: 2 },
    created_at: dateTime,
  }, ['id', 'nombre', 'especie', 'adoptada', 'created_at']),
  HistorialClinico: objectOf({
    id: { type: 'integer', example: 1 },
    mascota_id: { type: 'integer', example: 1 },
    fecha_registro: { ...dateTime, example: '2026-10-10T00:00:00.000Z' },
    descripcion: { type: 'string', example: 'Vacunación anual' },
    veterinario: nullableString('Dra. Torres'),
    created_at: dateTime,
    updated_at: dateTime,
  }, ['id', 'mascota_id', 'fecha_registro', 'descripcion']),
  SolicitudAdopcion: objectOf({
    id: { type: 'integer', example: 1 },
    usuario_id: { type: 'integer', example: 2 },
    mascota_id: { type: 'integer', example: 1 },
    estado: { ...estadoSolicitud, example: 'PENDIENTE' },
    mensaje: nullableString('Me gustaría adoptar a Firulais'),
    created_at: dateTime,
    updated_at: dateTime,
  }, ['id', 'usuario_id', 'mascota_id', 'estado']),
  LoginRequest: objectOf({
    email: { type: 'string', format: 'email', example: 'ana@example.com' },
    password: { type: 'string', example: 'secret123' },
  }, ['email', 'password']),
  LoginResponse: objectOf({
    status: successStatus,
    data: objectOf({
      token: { type: 'string', description: 'JWT Bearer token' },
      user: schemaRef('User'),
    }, ['token', 'user']),
  }, ['status', 'data']),
  HealthProcessResponse: healthData({}),
  HealthDatabaseResponse: healthData({
    databaseTime: { type: 'string', nullable: true, example: '2026-10-21T13:00:00.000Z' },
  }),
};

const responses = {
  SuccessOk: response('Respuesta exitosa', objectOf({ status: { type: 'string', enum: ['success', 'ok'] } })),
  Unauthorized: errorResponse('No autenticado o token inválido'),
  Forbidden: errorResponse('No tiene permisos suficientes'),
  NotFound: errorResponse('Recurso no encontrado'),
  BadRequest: errorResponse('Validación o entrada inválida'),
  InternalError: errorResponse('Error del servidor'),
  ServiceUnavailable: errorResponse('Dependencia no disponible (PostgreSQL inaccesible)'),
};

const mascota = schemaRef('Mascota');
const historial = schemaRef('HistorialClinico');
const solicitud = schemaRef('SolicitudAdopcion');

const mascotaFields = {
  nombre: { type: 'string' },
  especie: { type: 'string' },
  raza: nullableString(),
  edad: { type: 'integer', nullable: true },
  sexo,
  descripcion: nullableString(),
  adoptada: { type: 'boolean' },
};

const paths = {
  '/health': {
    get: operation('Health', 'Verifica que el proceso de Express esté disponible', {
      200: response('Proceso disponible', schemaRef('HealthProcessResponse')),
    }, { description: 'Comprobación de vida del proceso. No consulta PostgreSQL y no depende de la base de datos.' }),
  },
  '/api/db-check': {
    get: operation('Health', 'Verifica la disponibilidad de PostgreSQL', {
      200: response('Base de datos disponible', schemaRef('HealthDatabaseResponse')),
      ...errors(503),
    }, { description: 'Ejecuta una comprobación mínima (SELECT 1) sobre el pool de conexiones existente.' }),
  },
  '/api/auth/login': {
    post: operation('Auth', 'Inicia sesión y devuelve un JWT para las llamadas autenticadas', {
      200: response('Login exitoso', schemaRef('LoginResponse')),
      ...errors(400, 401, 500),
    }, { requestBody: jsonBody(schemaRef('LoginRequest')) }),
  },
  '/api/auth/validate-token': {
    get: operation('Auth', 'Valida el JWT actual y devuelve el usuario autenticado', {
      200: response('Token válido', success(objectOf({
        user: objectOf({ id: { type: 'integer' }, email: { type: 'string' }, rol: { type: 'string' } }),
      }))),
      ...errors(401, 500),
    }, { security: bearer }),
  },
  '/api/auth/admin-only': {
    get: roleCheck('Prueba de acceso exclusivo para administradores', 'admin access granted'),
  },
  '/api/auth/adoptante-only': {
    get: roleCheck('Prueba de acceso exclusivo para adoptantes', 'adoptante access granted'),
  },
  '/api/mascotas': {
    get: operation('Mascotas', 'Lista todas las mascotas', {
      200: response('Listado de mascotas', success(
        { type: 'array', items: mascota },
        { count: { type: 'integer', example: 2 } },
      )),
      ...errors(500),
    }),
    post: operation('Mascotas', 'Crea una nueva mascota', {
      201: response('Mascota creada', success(mascota)),
      ...errors(400, 500),
    }, {
      requestBody: jsonBody(objectOf({
        nombre: { type: 'string', example: 'Firulais' },
        especie: { type: 'string', example: 'Perro' },
        raza: nullableString('Labrador'),
        edad: { type: 'integer', nullable: true, example: 3 },
        sexo: { ...sexo, example: 'M' },
        descripcion: nullableString('Perro muy sociable'),
        adoptada: { type: 'boolean', example: false },
        creado_por: { type: 'integer', nullable: true, example: 2 },
      }, ['nombre', 'especie'])),
    }),
  },
  '/api/mascotas/{id}': {
    get: operation('Mascotas', 'Obtiene una mascota por ID', {
      200: response('Mascota encontrada', success(mascota)),
      ...errors(400, 404, 500),
    }, { parameters: idParam }),
    put: operation('Mascotas', 'Actualiza una mascota por ID', {
      200: response('Mascota actualizada', success(mascota)),
      ...errors(400, 404, 500),
    }, {
      parameters: idParam,
      requestBody: jsonBody({
        type: 'object',
        description: 'Campos parciales de la mascota a actualizar',
        properties: mascotaFields,
      }),
    }),
    delete: operation('Mascotas', 'Elimina una mascota por ID', {
      200: response('Mascota eliminada', successMessage('Mascota deleted successfully', mascota)),
      ...errors(400, 404, 500),
    }, { parameters: idParam }),
  },
  '/api/mascotas/{id}/historial': {
    get: securedById('Mascotas', 'Obtiene el historial clínico de una mascota', {
      200: response('Historial clínico', success({ type: 'array', items: historial })),
      ...errors(...AUTH_ERRORS),
    }),
    post: securedById('Mascotas', 'Agrega un registro al historial clínico de una mascota', {
      201: response('Registro creado', success(historial)),
      ...errors(...AUTH_ERRORS),
    }, {
      requestBody: jsonBody(objectOf({
        descripcion: { type: 'string', example: 'Vacunación anual' },
        veterinario: nullableString('Dra. Torres'),
      }, ['descripcion'])),
    }),
  },
  '/api/historial/{id}': {
    put: securedById('Mascotas', 'Actualiza un registro de historial clínico', {
      200: response('Registro actualizado', success(historial)),
      ...errors(...AUTH_ERRORS),
    }, {
      requestBody: jsonBody(objectOf({
        fecha_registro: { type: 'string', format: 'date-time' },
        descripcion: { type: 'string' },
        veterinario: nullableString(),
      })),
    }),
    delete: securedById('Mascotas', 'Elimina un registro de historial clínico', {
      200: response('Registro eliminado', successMessage('Historial clinico deleted successfully', historial)),
      ...errors(...AUTH_ERRORS),
    }),
  },
  '/api/solicitudes': {
    get: operation('Solicitudes', 'Lista solicitudes de adopción del usuario o del sistema', {
      200: response('Listado de solicitudes', success(
        { type: 'array', items: solicitud },
        { count: { type: 'integer', example: 1 } },
      )),
      ...errors(401, 403, 500),
    }, { security: bearer }),
    post: operation('Solicitudes', 'Crea una nueva solicitud de adopción', {
      201: response('Solicitud creada', success(solicitud)),
      ...errors(400, 401, 404, 500),
    }, {
      security: bearer,
      requestBody: jsonBody(objectOf({
        mascota_id: { type: 'integer', example: 1 },
        mensaje: nullableString('Me gustaría adoptar a Firulais'),
      }, ['mascota_id'])),
    }),
  },
  '/api/solicitudes/{id}': {
    get: securedById('Solicitudes', 'Obtiene una solicitud por ID', {
      200: response('Solicitud encontrada', success(solicitud)),
      ...errors(...AUTH_ERRORS),
    }),
    put: securedById('Solicitudes', 'Actualiza el estado de una solicitud (solo ADMIN)', {
      200: response('Estado actualizado', success(solicitud)),
      ...errors(...AUTH_ERRORS),
    }, {
      requestBody: jsonBody(objectOf({ estado: { ...estadoSolicitud, example: 'APROBADA' } }, ['estado'])),
    }),
  },
};

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'B-profesional API',
    version: '1.0.0',
    description: 'Documentación OpenAPI de la API Express del backend B-profesional.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Servidor local de desarrollo' }],
  tags: [
    { name: 'Health', description: 'Estado y verificación del servicio' },
    { name: 'Auth', description: 'Autenticación y autorización JWT' },
    { name: 'Mascotas', description: 'Gestión de mascotas y historial clínico' },
    { name: 'Solicitudes', description: 'Solicitudes de adopción' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas,
    responses,
  },
  paths,
};

module.exports = openApiSpec;
