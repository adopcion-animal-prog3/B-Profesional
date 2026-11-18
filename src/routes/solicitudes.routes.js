const express = require('express');
const { query } = require('../config/database');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { parsePositiveId, isJsonObject } = require('../utils/requestParsers');
const solicitudes = require('../services/solicitudes.service');

const router = express.Router();
const ALLOWED_STATES = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];
const anyRole = [authenticateToken, requireRole(['ADMIN', 'ADOPTANTE'])];

// Resuelve la solicitud de :id y verifica que el usuario pueda verla o gestionarla.
const loadAccessibleSolicitud = asyncHandler(async (req, res, next) => {
  const id = parsePositiveId(req.params.id);
  if (!id) return res.status(400).json(errorResponse('Invalid id parameter'));

  const solicitud = await solicitudes.findSolicitud(id);
  if (!solicitud) return res.status(404).json(errorResponse('Solicitud not found'));
  if (!(await solicitudes.canAccess(solicitud, req.user))) {
    return res.status(403).json(errorResponse('Insufficient permissions'));
  }
  req.solicitud = solicitud;
  return next();
});

router.get('/api/solicitudes', anyRole, asyncHandler(async (req, res) => {
  const rows = await solicitudes.listSolicitudes(req.user);
  return res.status(200).json(successResponse(rows, { count: rows.length }));
}));

router.get('/api/solicitudes/:id', anyRole, loadAccessibleSolicitud, (req, res) =>
  res.status(200).json(successResponse(req.solicitud)));

// Adoptar es exclusivo de cuentas personales (ADOPTANTE).
router.post('/api/solicitudes', authenticateToken, requireRole('ADOPTANTE'), asyncHandler(async (req, res) => {
  if (!isJsonObject(req.body)) return res.status(400).json(errorResponse('Request body is required'));

  const { mascota_id: rawMascotaId, mensaje } = req.body;
  const mascotaId = parsePositiveId(rawMascotaId);
  if (!mascotaId) return res.status(400).json(errorResponse('mascota_id must be a positive integer'));
  if (mensaje !== undefined && mensaje !== null && typeof mensaje !== 'string') {
    return res.status(400).json(errorResponse('mensaje must be a string'));
  }

  const mascotaRes = await query('SELECT id, adoptada FROM mascotas WHERE id = $1', [mascotaId]);
  const mascota = mascotaRes.rows?.[0];
  if (!mascota) return res.status(404).json(errorResponse('Mascota not found'));
  if (mascota.adoptada === true) {
    return res.status(400).json(errorResponse('Mascota is not available for adoption'));
  }

  const insertRes = await query(
    `INSERT INTO solicitudes_adopcion (usuario_id, mascota_id, estado, mensaje) VALUES ($1, $2, $3, $4) RETURNING ${solicitudes.SOLICITUD_COLUMNS}`,
    [req.user.id, mascotaId, 'PENDIENTE', mensaje || null],
  );
  return res.status(201).json(successResponse(insertRes.rows[0]));
}));

const validateEstado = (req, res, next) => {
  const { estado } = req.body || {};
  if (typeof estado !== 'string' || !ALLOWED_STATES.includes(estado)) {
    return res.status(400).json(errorResponse('Estado must be one of: PENDIENTE, APROBADA, RECHAZADA'));
  }
  return next();
};

router.put('/api/solicitudes/:id', authenticateToken, requireRole('ADMIN'), validateEstado,
  loadAccessibleSolicitud, asyncHandler(async (req, res) => {
    const { estado } = req.body;
    const current = req.solicitud.estado;
    if (current !== 'PENDIENTE' && current !== estado) {
      return res.status(400).json(errorResponse(`Cannot change request status from ${current} to ${estado}`));
    }
    const updated = await solicitudes.updateEstado(req.solicitud, estado);
    return res.status(200).json(successResponse(updated));
  }));

module.exports = router;
