const express = require('express');
const { query } = require('../config/database');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { parsePositiveId, isJsonObject } = require('../utils/requestParsers');
const { validateMascota } = require('../validators/mascota.validator');

const router = express.Router();

const MASCOTA_COLUMNS = 'id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, imagen, created_at';
const UPDATABLE_FIELDS = ['nombre', 'especie', 'raza', 'edad', 'sexo', 'descripcion', 'adoptada', 'imagen'];
const onlyProfesional = [authenticateToken, requireRole('ADMIN')];

async function findMascota(id) {
  const result = await query(`SELECT ${MASCOTA_COLUMNS} FROM mascotas WHERE id = $1`, [id]);
  return result.rows?.[0] || null;
}

// Una mascota sin dueño registrado puede gestionarla cualquier cuenta profesional.
const canManage = (mascota, user) =>
  mascota.creado_por == null || String(mascota.creado_por) === String(user.id);

// Carga la mascota del parámetro :id y verifica que la cuenta pueda gestionarla.
const loadOwnedMascota = asyncHandler(async (req, res, next) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json(errorResponse('Invalid id parameter'));

  const mascota = await findMascota(id);
  if (!mascota) return res.status(404).json(errorResponse('Mascota not found'));
  if (!canManage(mascota, req.user)) {
    return res.status(403).json(errorResponse('Only the publisher can modify this mascota'));
  }
  req.mascota = mascota;
  return next();
});

router.get('/api/mascotas', asyncHandler(async (req, res) => {
  const result = await query(`SELECT ${MASCOTA_COLUMNS} FROM mascotas`);
  return res.status(200).json(successResponse(result.rows, { count: result.rows.length }));
}));

router.get('/api/mascotas/:id', asyncHandler(async (req, res) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json(errorResponse('Invalid id parameter'));

  const mascota = await findMascota(id);
  if (!mascota) return res.status(404).json(errorResponse('Mascota not found'));
  return res.status(200).json(successResponse(mascota));
}));

router.post('/api/mascotas', onlyProfesional, asyncHandler(async (req, res) => {
  const body = req.body;
  if (!isJsonObject(body)) return res.status(400).json(errorResponse('Request body is required'));

  const validationError = validateMascota(body);
  if (validationError) return res.status(400).json(errorResponse(validationError));

  const { nombre, especie, raza, edad, sexo, descripcion, adoptada, imagen } = body;
  const result = await query(
    `INSERT INTO mascotas (nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, imagen) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${MASCOTA_COLUMNS}`,
    [nombre, especie, raza || null, edad ?? null, sexo || null, descripcion || null,
      adoptada ?? false, req.user.id, imagen || null],
  );
  return res.status(201).json(successResponse(result.rows[0]));
}));

router.put('/api/mascotas/:id', onlyProfesional, loadOwnedMascota, asyncHandler(async (req, res) => {
  const body = req.body;
  if (!isJsonObject(body)) return res.status(400).json(errorResponse('Request body is required'));

  const validationError = validateMascota(body, true);
  if (validationError) return res.status(400).json(errorResponse(validationError));

  const changes = UPDATABLE_FIELDS.filter((field) => body[field] !== undefined);
  if (changes.length === 0) return res.status(200).json(successResponse(req.mascota));

  const assignments = changes.map((field, index) => `${field} = $${index + 1}`);
  const params = [...changes.map((field) => body[field]), req.mascota.id];
  const result = await query(
    `UPDATE mascotas SET ${assignments.join(', ')} WHERE id = $${params.length} RETURNING ${MASCOTA_COLUMNS}`,
    params,
  );
  return res.status(200).json(successResponse(result.rows[0]));
}));

router.delete('/api/mascotas/:id', onlyProfesional, loadOwnedMascota, asyncHandler(async (req, res) => {
  const result = await query(`DELETE FROM mascotas WHERE id = $1 RETURNING ${MASCOTA_COLUMNS}`, [req.mascota.id]);
  return res.status(200).json(successResponse({
    message: 'Mascota deleted successfully',
    data: result.rows[0],
  }));
}));

module.exports = router;
