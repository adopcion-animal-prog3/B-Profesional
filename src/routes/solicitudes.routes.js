const express = require('express');
const { query } = require('../config/database');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const router = express.Router();

router.get('/api/solicitudes', authenticateToken, requireRole(['ADMIN', 'ADOPTANTE']), asyncHandler(async (req, res) => {
  const userRole = req.user && req.user.rol;
  const userId = req.user && req.user.id;

  if (!userRole || (userRole !== 'ADMIN' && userRole !== 'ADOPTANTE')) {
    return res.status(403).json(errorResponse('Insufficient permissions'));
  }

  let sql = `
    SELECT id, usuario_id, mascota_id, estado, mensaje, created_at, updated_at
    FROM solicitudes_adopcion
  `;
  const params = [];

  if (userRole === 'ADOPTANTE') {
    sql += ' WHERE usuario_id = $1';
    params.push(userId);
  }

  sql += ' ORDER BY created_at DESC';

  const result = await query(sql, params);

  return res.status(200).json(successResponse(result.rows, { count: result.rows.length }));
}));

router.get('/api/solicitudes/:id', authenticateToken, requireRole(['ADMIN', 'ADOPTANTE']), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const solicitudId = Number(id);

  if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
    return res.status(400).json(errorResponse('Invalid id parameter'));
  }

  const userRole = req.user && req.user.rol;
  const userId = req.user && req.user.id;

  const result = await query(
    `SELECT id, usuario_id, mascota_id, estado, mensaje, created_at, updated_at
     FROM solicitudes_adopcion
     WHERE id = $1`,
    [solicitudId]
  );

  if (!result.rows || result.rows.length === 0) {
    return res.status(404).json(errorResponse('Solicitud not found'));
  }

  const solicitud = result.rows[0];

  if (userRole === 'ADOPTANTE' && solicitud.usuario_id !== userId) {
    return res.status(403).json(errorResponse('Insufficient permissions'));
  }

  return res.status(200).json(successResponse(solicitud));
}));

router.post('/api/solicitudes', authenticateToken, asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json(errorResponse('Request body is required'));
  }

  const { mascota_id, mensaje } = body;
  const mascotaId = Number(mascota_id);

  if (!Number.isInteger(mascotaId) || mascotaId <= 0) {
    return res.status(400).json(errorResponse('mascota_id must be a positive integer'));
  }

  if (mensaje !== undefined && mensaje !== null && typeof mensaje !== 'string') {
    return res.status(400).json(errorResponse('mensaje must be a string'));
  }

  const usuarioId = req.user && req.user.id;
  if (!usuarioId) {
    return res.status(401).json(errorResponse('Authentication required'));
  }

  const mascotaRes = await query(
    'SELECT id, adoptada FROM mascotas WHERE id = $1',
    [mascotaId]
  );

  if (!mascotaRes.rows || mascotaRes.rows.length === 0) {
    return res.status(404).json(errorResponse('Mascota not found'));
  }

  const mascota = mascotaRes.rows[0];
  if (mascota.adoptada === true) {
    return res.status(400).json(errorResponse('Mascota is not available for adoption'));
  }

  const insertRes = await query(
    'INSERT INTO solicitudes_adopcion (usuario_id, mascota_id, estado, mensaje) VALUES ($1, $2, $3, $4) RETURNING id, usuario_id, mascota_id, estado, mensaje, created_at, updated_at',
    [usuarioId, mascotaId, 'PENDIENTE', mensaje || null]
  );

  const created = insertRes.rows[0];
  return res.status(201).json(successResponse(created));
}));

router.put('/api/solicitudes/:id', authenticateToken, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const solicitudId = Number(id);

  if (!Number.isInteger(solicitudId) || solicitudId <= 0) {
    return res.status(400).json(errorResponse('Invalid id parameter'));
  }

  const { estado } = req.body || {};
  const allowedStates = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];

  if (typeof estado !== 'string' || !allowedStates.includes(estado)) {
    return res.status(400).json(errorResponse('Estado must be one of: PENDIENTE, APROBADA, RECHAZADA'));
  }

  const existing = await query(
    `SELECT id, usuario_id, mascota_id, estado, mensaje, created_at, updated_at
     FROM solicitudes_adopcion WHERE id = $1`,
    [solicitudId]
  );

  if (!existing.rows || existing.rows.length === 0) {
    return res.status(404).json(errorResponse('Solicitud not found'));
  }

  const result = await query(
    `UPDATE solicitudes_adopcion
     SET estado = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, usuario_id, mascota_id, estado, mensaje, created_at, updated_at`,
    [estado, solicitudId]
  );

  return res.status(200).json(successResponse(result.rows[0]));
}));

module.exports = router;
