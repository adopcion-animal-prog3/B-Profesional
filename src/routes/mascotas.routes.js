const express = require('express');
const { query } = require('../config/database');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const router = express.Router();

const SEXOS_VALIDOS = ['M', 'F', 'OTRO'];

function validateMascota(data, partial = false) {
  const has = (field) => Object.prototype.hasOwnProperty.call(data, field);
  const textLength = (value) => [...value].length;

  for (const [field, maxLength] of [['nombre', 150], ['especie', 100]]) {
    if (partial && !has(field)) continue;
    const value = data[field];
    if (typeof value !== 'string' || value.trim() === '') {
      return `Field "${field}" is required and must be a non-empty string`;
    }
    if (textLength(value) > maxLength) {
      return `Field "${field}" must not exceed ${maxLength} characters`;
    }
  }

  if (has('raza') && data.raza !== null) {
    if (typeof data.raza !== 'string') {
      return 'Field "raza" must be a string or null';
    }
    if (textLength(data.raza) > 120) {
      return 'Field "raza" must not exceed 120 characters';
    }
  }

  if (has('edad') && data.edad !== null &&
      (!Number.isInteger(data.edad) || data.edad < 0 || data.edad > 2147483647)) {
    return 'Field "edad" must be a non-negative integer within the supported range';
  }

  if (has('sexo') && data.sexo !== null && !SEXOS_VALIDOS.includes(data.sexo)) {
    return 'Field "sexo" must be one of M, F, OTRO, or null';
  }

  if (has('descripcion') && data.descripcion !== null && typeof data.descripcion !== 'string') {
    return 'Field "descripcion" must be a string or null';
  }

  if (has('adoptada') && typeof data.adoptada !== 'boolean') {
    return 'Field "adoptada" must be boolean';
  }

  if (has('creado_por') && data.creado_por !== null &&
      (!Number.isSafeInteger(data.creado_por) || data.creado_por <= 0)) {
    return 'Field "creado_por" must be a positive integer or null';
  }

  return null;
}

router.get('/api/mascotas', asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at FROM mascotas'
  );

  return res.status(200).json(successResponse(result.rows, { count: result.rows.length }));
}));

router.get('/api/mascotas/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json(errorResponse('Invalid id parameter'));
  }

  const result = await query(
    'SELECT id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at FROM mascotas WHERE id = $1',
    [numericId]
  );

  if (!result.rows || result.rows.length === 0) {
    return res.status(404).json(errorResponse('Mascota not found'));
  }

  return res.status(200).json(successResponse(result.rows[0]));
}));

router.post('/api/mascotas', asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json(errorResponse('Request body is required'));
  }

  const { nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por } = body;
  const validationError = validateMascota(body);
  if (validationError) {
    return res.status(400).json(errorResponse(validationError));
  }

  const insertQuery = `INSERT INTO mascotas (nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at`;
  const params = [
    nombre,
    especie,
    raza || null,
    edad !== undefined ? edad : null,
    sexo || null,
    descripcion || null,
    adoptada !== undefined ? adoptada : false,
    creado_por || null,
  ];

  const result = await query(insertQuery, params);
  const created = result.rows[0];

  return res.status(201).json(successResponse(created));
}));

router.put('/api/mascotas/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json(errorResponse('Invalid id parameter'));
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json(errorResponse('Request body is required'));
  }

  const { nombre, especie, raza, edad, sexo, descripcion, adoptada } = body;
  const validationError = validateMascota(body, true);
  if (validationError) {
    return res.status(400).json(errorResponse(validationError));
  }

  const exists = await query('SELECT id FROM mascotas WHERE id = $1', [numericId]);
  if (!exists.rows || exists.rows.length === 0) {
    return res.status(404).json(errorResponse('Mascota not found'));
  }

  const fields = [];
  const params = [];
  let idx = 1;

  if (nombre !== undefined) { fields.push(`nombre = $${idx++}`); params.push(nombre); }
  if (especie !== undefined) { fields.push(`especie = $${idx++}`); params.push(especie); }
  if (raza !== undefined) { fields.push(`raza = $${idx++}`); params.push(raza); }
  if (edad !== undefined) { fields.push(`edad = $${idx++}`); params.push(edad); }
  if (sexo !== undefined) { fields.push(`sexo = $${idx++}`); params.push(sexo); }
  if (descripcion !== undefined) { fields.push(`descripcion = $${idx++}`); params.push(descripcion); }
  if (adoptada !== undefined) { fields.push(`adoptada = $${idx++}`); params.push(adoptada); }

  if (fields.length === 0) {
    const current = await query('SELECT id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at FROM mascotas WHERE id = $1', [numericId]);
    return res.status(200).json(successResponse(current.rows[0]));
  }

  const updateQuery = `UPDATE mascotas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at`;
  params.push(numericId);

  const result = await query(updateQuery, params);
  const updated = result.rows[0];

  return res.status(200).json(successResponse(updated));
}));

router.delete('/api/mascotas/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json(errorResponse('Invalid id parameter'));
  }

  const exists = await query('SELECT id FROM mascotas WHERE id = $1', [numericId]);
  if (!exists.rows || exists.rows.length === 0) {
    return res.status(404).json(errorResponse('Mascota not found'));
  }

  const result = await query('DELETE FROM mascotas WHERE id = $1 RETURNING id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at', [numericId]);

  return res.status(200).json(successResponse({
    message: 'Mascota deleted successfully',
    data: result.rows[0],
  }));
}));

router.get('/api/mascotas/:id/historial', authenticateToken, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const mascotaId = Number(id);

  if (!Number.isInteger(mascotaId) || mascotaId <= 0) {
    return res.status(400).json(errorResponse('Invalid id parameter'));
  }

  const mascotaResult = await query('SELECT id FROM mascotas WHERE id = $1', [mascotaId]);
  if (!mascotaResult.rows || mascotaResult.rows.length === 0) {
    return res.status(404).json(errorResponse('Mascota not found'));
  }

  const historialResult = await query(
    `SELECT id, mascota_id, fecha_registro, descripcion, veterinario, created_at, updated_at
     FROM historial_clinico
     WHERE mascota_id = $1
     ORDER BY fecha_registro DESC`,
    [mascotaId]
  );

  return res.status(200).json(successResponse(historialResult.rows));
}));

router.post('/api/mascotas/:id/historial', authenticateToken, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const mascotaId = Number(id);

  if (!Number.isInteger(mascotaId) || mascotaId <= 0) {
    return res.status(400).json(errorResponse('Invalid id parameter'));
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json(errorResponse('Request body is required'));
  }

  const { descripcion, veterinario } = body;
  if (typeof descripcion !== 'string' || descripcion.trim() === '') {
    return res.status(400).json(errorResponse('Field "descripcion" is required and must be a non-empty string'));
  }

  if (veterinario !== undefined && veterinario !== null && typeof veterinario !== 'string') {
    return res.status(400).json(errorResponse('Field "veterinario" must be a string or null'));
  }

  const normalizedDescripcion = descripcion.trim();
  const normalizedVeterinario = (veterinario === undefined || veterinario === null) ? null : veterinario.trim();

  if (normalizedVeterinario !== null && normalizedVeterinario.length > 200) {
    return res.status(400).json(errorResponse('Field "veterinario" must not exceed 200 characters'));
  }

  const mascotaExists = await query('SELECT id FROM mascotas WHERE id = $1', [mascotaId]);
  if (!mascotaExists.rows || mascotaExists.rows.length === 0) {
    return res.status(404).json(errorResponse('Mascota not found'));
  }

  const insertQuery = `
    INSERT INTO historial_clinico (mascota_id, descripcion, veterinario)
    VALUES ($1, $2, $3)
    RETURNING id, mascota_id, fecha_registro, descripcion, veterinario, created_at, updated_at
  `;

  const result = await query(insertQuery, [mascotaId, normalizedDescripcion, normalizedVeterinario]);
  return res.status(201).json(successResponse(result.rows[0]));
}));

router.put('/api/historial/:id', authenticateToken, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const historialId = Number(id);

  if (!Number.isInteger(historialId) || historialId <= 0) {
    return res.status(400).json(errorResponse('Invalid id parameter'));
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json(errorResponse('Request body is required'));
  }

  const forbiddenFields = ['id', 'mascota_id', 'created_at'];
  const hasForbiddenField = forbiddenFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
  if (hasForbiddenField) {
    return res.status(400).json(errorResponse('Fields "id", "mascota_id" and "created_at" cannot be modified'));
  }

  const setFields = [];
  const params = [];
  let paramIndex = 1;

  if (Object.prototype.hasOwnProperty.call(body, 'fecha_registro')) {
    const value = body.fecha_registro;
    if (typeof value !== 'string' || value.trim() === '') {
      return res.status(400).json(errorResponse('Field "fecha_registro" must be a non-empty ISO date string'));
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json(errorResponse('Field "fecha_registro" must be a valid date'));
    }

    setFields.push(`fecha_registro = $${paramIndex++}`);
    params.push(value);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'descripcion')) {
    const value = body.descripcion;
    if (typeof value !== 'string' || value.trim() === '') {
      return res.status(400).json(errorResponse('Field "descripcion" is required and must be a non-empty string'));
    }

    setFields.push(`descripcion = $${paramIndex++}`);
    params.push(value.trim());
  }

  if (Object.prototype.hasOwnProperty.call(body, 'veterinario')) {
    const value = body.veterinario;
    if (value !== null && value !== undefined && typeof value !== 'string') {
      return res.status(400).json(errorResponse('Field "veterinario" must be a string or null'));
    }

    setFields.push(`veterinario = $${paramIndex++}`);
    params.push(value === null || value === undefined ? null : value.trim());
  }

  const existing = await query('SELECT id FROM historial_clinico WHERE id = $1', [historialId]);
  if (!existing.rows || existing.rows.length === 0) {
    return res.status(404).json(errorResponse('Historial clinico not found'));
  }

  if (setFields.length === 0) {
    const current = await query(
      'SELECT id, mascota_id, fecha_registro, descripcion, veterinario, created_at, updated_at FROM historial_clinico WHERE id = $1',
      [historialId]
    );
    return res.status(200).json(successResponse(current.rows[0]));
  }

  setFields.push('updated_at = NOW()');
  const updateQuery = `
    UPDATE historial_clinico
    SET ${setFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, mascota_id, fecha_registro, descripcion, veterinario, created_at, updated_at
  `;

  params.push(historialId);
  const result = await query(updateQuery, params);

  return res.status(200).json(successResponse(result.rows[0]));
}));

router.delete('/api/historial/:id', authenticateToken, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const historialId = Number(id);

  if (!Number.isInteger(historialId) || historialId <= 0) {
    return res.status(400).json(errorResponse('Invalid id parameter'));
  }

  const existing = await query(
    'SELECT id FROM historial_clinico WHERE id = $1',
    [historialId]
  );

  if (!existing.rows || existing.rows.length === 0) {
    return res.status(404).json(errorResponse('Historial clinico not found'));
  }

  const result = await query(
    'DELETE FROM historial_clinico WHERE id = $1 RETURNING id, mascota_id, fecha_registro, descripcion, veterinario, created_at, updated_at',
    [historialId]
  );

  return res.status(200).json(successResponse({
    message: 'Historial clinico deleted successfully',
    data: result.rows[0],
  }));
}));

module.exports = router;

