const express = require('express');
const { query } = require('../config/database');
const authenticateToken = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { parsePositiveId, isJsonObject } = require('../utils/requestParsers');
const mensajes = require('../services/mensajes.service');

const router = express.Router();
router.use('/api/mensajes', authenticateToken);

function validateMensaje(body, userId) {
  if (!isJsonObject(body)) return 'Request body is required';
  const destinatarioId = parsePositiveId(body.destinatario_id);
  if (!destinatarioId) return 'destinatario_id must be a positive integer';
  if (String(destinatarioId) === String(userId)) return 'You cannot send a message to yourself';
  if (body.mascota_id != null && !parsePositiveId(body.mascota_id)) {
    return 'mascota_id must be a positive integer or null';
  }
  const contenido = typeof body.contenido === 'string' ? body.contenido.trim() : '';
  if (!contenido) return 'contenido is required and must be a non-empty string';
  if (contenido.length > mensajes.MAX_CONTENIDO) {
    return `contenido must not exceed ${mensajes.MAX_CONTENIDO} characters`;
  }
  return null;
}

// Resuelve la otra cuenta de la conversación a partir de :usuarioId.
const loadOtroUsuario = asyncHandler(async (req, res, next) => {
  const otroId = parsePositiveId(req.params.usuarioId);
  if (!otroId) return res.status(400).json(errorResponse('Invalid usuarioId parameter'));
  const usuario = await mensajes.findUsuario(otroId);
  if (!usuario) return res.status(404).json(errorResponse('Usuario not found'));
  req.otroUsuario = usuario;
  return next();
});

router.get('/api/mensajes/conversaciones', asyncHandler(async (req, res) => {
  const conversaciones = await mensajes.listConversaciones(req.user.id);
  return res.status(200).json(successResponse(conversaciones, { count: conversaciones.length }));
}));

router.get('/api/mensajes/conversaciones/:usuarioId', loadOtroUsuario, asyncHandler(async (req, res) => {
  const lista = await mensajes.getConversacion(req.user.id, req.otroUsuario.id);
  return res.status(200).json(successResponse({ usuario: req.otroUsuario, mensajes: lista }));
}));

router.put('/api/mensajes/conversaciones/:usuarioId/leidos', loadOtroUsuario, asyncHandler(async (req, res) => {
  const actualizados = await mensajes.marcarLeidos(req.user.id, req.otroUsuario.id);
  return res.status(200).json(successResponse({ actualizados }));
}));

router.post('/api/mensajes', asyncHandler(async (req, res) => {
  const validationError = validateMensaje(req.body, req.user.id);
  if (validationError) return res.status(400).json(errorResponse(validationError));

  const destinatarioId = parsePositiveId(req.body.destinatario_id);
  if (!(await mensajes.findUsuario(destinatarioId))) {
    return res.status(404).json(errorResponse('Usuario not found'));
  }
  const mascotaId = req.body.mascota_id == null ? null : parsePositiveId(req.body.mascota_id);
  if (mascotaId) {
    const mascota = await query('SELECT id FROM mascotas WHERE id = $1', [mascotaId]);
    if (!mascota.rows?.length) return res.status(404).json(errorResponse('Mascota not found'));
  }

  const creado = await mensajes.crearMensaje({
    remitenteId: req.user.id,
    destinatarioId,
    mascotaId,
    contenido: req.body.contenido.trim(),
  });
  return res.status(201).json(successResponse(creado));
}));

module.exports = router;
