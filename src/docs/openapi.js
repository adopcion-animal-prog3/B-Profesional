const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'B-profesional API',
    version: '1.0.0',
    description: 'Documentación OpenAPI de la API Express del backend B-profesional.',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor local de desarrollo',
    },
  ],
  tags: [
    { name: 'Health', description: 'Estado y verificación del servicio' },
    { name: 'Auth', description: 'Autenticación y autorización JWT' },
    { name: 'Mascotas', description: 'Gestión de mascotas y historial clínico' },
    { name: 'Solicitudes', description: 'Solicitudes de adopción' },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['error'] },
          message: { type: 'string', description: 'Descripción del error' },
        },
        required: ['status', 'message'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nombre: { type: 'string', example: 'Ana Gomez' },
          email: { type: 'string', format: 'email', example: 'ana@example.com' },
          rol: { type: 'string', enum: ['ADMIN', 'ADOPTANTE'] },
        },
        required: ['id', 'nombre', 'email', 'rol'],
      },
      Mascota: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nombre: { type: 'string', example: 'Firulais' },
          especie: { type: 'string', example: 'Perro' },
          raza: { type: 'string', nullable: true, example: 'Labrador' },
          edad: { type: 'integer', nullable: true, example: 3 },
          sexo: { type: 'string', enum: ['M', 'F', 'OTRO'], nullable: true, example: 'M' },
          descripcion: { type: 'string', nullable: true, example: 'Perro muy sociable' },
          adoptada: { type: 'boolean', example: false },
          creado_por: { type: 'integer', nullable: true, example: 2 },
          created_at: { type: 'string', format: 'date-time', example: '2026-10-16T10:00:00.000Z' },
        },
        required: ['id', 'nombre', 'especie', 'adoptada', 'created_at'],
      },
      HistorialClinico: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          mascota_id: { type: 'integer', example: 1 },
          fecha_registro: { type: 'string', format: 'date-time', example: '2026-10-10T00:00:00.000Z' },
          descripcion: { type: 'string', example: 'Vacunación anual' },
          veterinario: { type: 'string', nullable: true, example: 'Dra. Torres' },
          created_at: { type: 'string', format: 'date-time', example: '2026-10-16T10:00:00.000Z' },
          updated_at: { type: 'string', format: 'date-time', example: '2026-10-16T10:00:00.000Z' },
        },
        required: ['id', 'mascota_id', 'fecha_registro', 'descripcion'],
      },
      SolicitudAdopcion: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          usuario_id: { type: 'integer', example: 2 },
          mascota_id: { type: 'integer', example: 1 },
          estado: { type: 'string', enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'], example: 'PENDIENTE' },
          mensaje: { type: 'string', nullable: true, example: 'Me gustaría adoptar a Firulais' },
          created_at: { type: 'string', format: 'date-time', example: '2026-10-16T10:00:00.000Z' },
          updated_at: { type: 'string', format: 'date-time', example: '2026-10-16T10:00:00.000Z' },
        },
        required: ['id', 'usuario_id', 'mascota_id', 'estado'],
      },
      LoginRequest: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', example: 'ana@example.com' },
          password: { type: 'string', example: 'secret123' },
        },
        required: ['email', 'password'],
      },
      LoginResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['success'] },
          data: {
            type: 'object',
            properties: {
              token: { type: 'string', description: 'JWT Bearer token' },
              user: { $ref: '#/components/schemas/User' },
            },
            required: ['token', 'user'],
          },
        },
        required: ['status', 'data'],
      },
      SaludResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok'] },
        },
        required: ['status'],
      },
    },
    responses: {
      SuccessOk: {
        description: 'Respuesta exitosa',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                status: { type: 'string', enum: ['success', 'ok'] },
              },
            },
          },
        },
      },
      Unauthorized: {
        description: 'No autenticado o token inválido',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      Forbidden: {
        description: 'No tiene permisos suficientes',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      NotFound: {
        description: 'Recurso no encontrado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      BadRequest: {
        description: 'Validación o entrada inválida',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      InternalError: {
        description: 'Error del servidor',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Verifica que el backend esté levantado',
        responses: {
          200: {
            description: 'Servicio disponible',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SaludResponse' },
              },
            },
          },
        },
      },
    },
    '/api/db-check': {
      get: {
        tags: ['Health'],
        summary: 'Verifica la conexión y disponibilidad de PostgreSQL',
        responses: {
          200: {
            description: 'Base de datos disponible',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok'] },
                    databaseTime: { type: 'string', nullable: true, example: '2026-10-16T13:00:00.000Z' },
                  },
                  required: ['status'],
                },
              },
            },
          },
          503: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Inicia sesión y devuelve un JWT para las llamadas autenticadas',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Login exitoso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/auth/validate-token': {
      get: {
        tags: ['Auth'],
        summary: 'Valida el JWT actual y devuelve el usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Token válido',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer' },
                            email: { type: 'string' },
                            rol: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/auth/admin-only': {
      get: {
        tags: ['Auth'],
        summary: 'Prueba de acceso exclusivo para administradores',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Acceso permitido',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        message: { type: 'string', example: 'admin access granted' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/auth/adoptante-only': {
      get: {
        tags: ['Auth'],
        summary: 'Prueba de acceso exclusivo para adoptantes',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Acceso permitido',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'object',
                      properties: {
                        message: { type: 'string', example: 'adoptante access granted' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/mascotas': {
      get: {
        tags: ['Mascotas'],
        summary: 'Lista todas las mascotas',
        responses: {
          200: {
            description: 'Listado de mascotas',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Mascota' },
                    },
                    count: { type: 'integer', example: 2 },
                  },
                },
              },
            },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Mascotas'],
        summary: 'Crea una nueva mascota',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nombre: { type: 'string', example: 'Firulais' },
                  especie: { type: 'string', example: 'Perro' },
                  raza: { type: 'string', nullable: true, example: 'Labrador' },
                  edad: { type: 'integer', nullable: true, example: 3 },
                  sexo: { type: 'string', enum: ['M', 'F', 'OTRO'], nullable: true, example: 'M' },
                  descripcion: { type: 'string', nullable: true, example: 'Perro muy sociable' },
                  adoptada: { type: 'boolean', example: false },
                  creado_por: { type: 'integer', nullable: true, example: 2 },
                },
                required: ['nombre', 'especie'],
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Mascota creada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: { $ref: '#/components/schemas/Mascota' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/mascotas/{id}': {
      get: {
        tags: ['Mascotas'],
        summary: 'Obtiene una mascota por ID',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: {
          200: {
            description: 'Mascota encontrada',
            content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['success'] }, data: { $ref: '#/components/schemas/Mascota' } } } } },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      put: {
        tags: ['Mascotas'],
        summary: 'Actualiza una mascota por ID',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Campos parciales de la mascota a actualizar',
                properties: {
                  nombre: { type: 'string' },
                  especie: { type: 'string' },
                  raza: { type: 'string', nullable: true },
                  edad: { type: 'integer', nullable: true },
                  sexo: { type: 'string', enum: ['M', 'F', 'OTRO'], nullable: true },
                  descripcion: { type: 'string', nullable: true },
                  adoptada: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Mascota actualizada', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['success'] }, data: { $ref: '#/components/schemas/Mascota' } } } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      delete: {
        tags: ['Mascotas'],
        summary: 'Elimina una mascota por ID',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: {
          200: {
            description: 'Mascota eliminada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: { $ref: '#/components/schemas/Mascota' },
                    message: { type: 'string', example: 'Mascota deleted successfully' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/mascotas/{id}/historial': {
      get: {
        tags: ['Mascotas'],
        summary: 'Obtiene el historial clínico de una mascota',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: {
          200: {
            description: 'Historial clínico',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: { type: 'array', items: { $ref: '#/components/schemas/HistorialClinico' } },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Mascotas'],
        summary: 'Agrega un registro al historial clínico de una mascota',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  descripcion: { type: 'string', example: 'Vacunación anual' },
                  veterinario: { type: 'string', nullable: true, example: 'Dra. Torres' },
                },
                required: ['descripcion'],
              },
            },
          },
        },
        responses: {
          201: { description: 'Registro creado', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['success'] }, data: { $ref: '#/components/schemas/HistorialClinico' } } } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/historial/{id}': {
      put: {
        tags: ['Mascotas'],
        summary: 'Actualiza un registro de historial clínico',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fecha_registro: { type: 'string', format: 'date-time' },
                  descripcion: { type: 'string' },
                  veterinario: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Registro actualizado', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['success'] }, data: { $ref: '#/components/schemas/HistorialClinico' } } } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      delete: {
        tags: ['Mascotas'],
        summary: 'Elimina un registro de historial clínico',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: {
          200: { description: 'Registro eliminado', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['success'] }, data: { $ref: '#/components/schemas/HistorialClinico' }, message: { type: 'string', example: 'Historial clinico deleted successfully' } } } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/solicitudes': {
      get: {
        tags: ['Solicitudes'],
        summary: 'Lista solicitudes de adopción del usuario o del sistema',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Listado de solicitudes',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/SolicitudAdopcion' },
                    },
                    count: { type: 'integer', example: 1 },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Solicitudes'],
        summary: 'Crea una nueva solicitud de adopción',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  mascota_id: { type: 'integer', example: 1 },
                  mensaje: { type: 'string', nullable: true, example: 'Me gustaría adoptar a Firulais' },
                },
                required: ['mascota_id'],
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Solicitud creada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: { $ref: '#/components/schemas/SolicitudAdopcion' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/solicitudes/{id}': {
      get: {
        tags: ['Solicitudes'],
        summary: 'Obtiene una solicitud por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        responses: {
          200: {
            description: 'Solicitud encontrada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: { $ref: '#/components/schemas/SolicitudAdopcion' },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      put: {
        tags: ['Solicitudes'],
        summary: 'Actualiza el estado de una solicitud (solo ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer', minimum: 1 } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  estado: { type: 'string', enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'], example: 'APROBADA' },
                },
                required: ['estado'],
              },
            },
          },
        },
        responses: {
          200: { description: 'Estado actualizado', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['success'] }, data: { $ref: '#/components/schemas/SolicitudAdopcion' } } } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
  },
};

module.exports = openApiSpec;
