const express = require('express');
const { query } = require('../config/database');
const authenticateToken = require('../middleware/auth.middleware');
const requireRole = require('../middleware/role.middleware');

const router = express.Router();

router.get('/api/solicitudes', authenticateToken, requireRole(['ADMIN', 'ADOPTANTE']), async (req, res) => {
  const userRole = req.user && req.user.rol;
  const userId = req.user && req.user.id;

  if (!userRole || (userRole !== 'ADMIN' && userRole !== 'ADOPTANTE')) {
    return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
  }

  try {
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

    return res.status(200).json({
      status: 'success',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching solicitudes:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving solicitudes from database',
    });
  }
});

// POST /api/solicitudes — crear una solicitud de adopción
router.post('/api/solicitudes', authenticateToken, async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ status: 'error', message: 'Request body is required' });
  }

  const { mascota_id, mensaje } = body;
  const mascotaId = Number(mascota_id);

  if (!Number.isInteger(mascotaId) || mascotaId <= 0) {
    return res.status(400).json({ status: 'error', message: 'mascota_id must be a positive integer' });
  }

  if (mensaje !== undefined && mensaje !== null && typeof mensaje !== 'string') {
    return res.status(400).json({ status: 'error', message: 'mensaje must be a string' });
  }

  const usuarioId = req.user && req.user.id;
  if (!usuarioId) {
    return res.status(401).json({ status: 'error', message: 'Authentication required' });
  }

  try {
    // Verificar que la mascota exista
    const mascotaRes = await query(
      'SELECT id, adoptada FROM mascotas WHERE id = $1',
      [mascotaId]
    );

    if (!mascotaRes.rows || mascotaRes.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Mascota not found' });
    }

    const mascota = mascotaRes.rows[0];
    if (mascota.adoptada === true) {
      return res.status(400).json({ status: 'error', message: 'Mascota is not available for adoption' });
    }

    const insertRes = await query(
      'INSERT INTO solicitudes_adopcion (usuario_id, mascota_id, estado, mensaje) VALUES ($1, $2, $3, $4) RETURNING id, usuario_id, mascota_id, estado, mensaje, created_at, updated_at',
      [usuarioId, mascotaId, 'PENDIENTE', mensaje || null]
    );

    const created = insertRes.rows[0];
    return res.status(201).json({ status: 'success', data: created });
  } catch (error) {
    console.error('Error creating solicitud:', error.message);
    return res.status(500).json({ status: 'error', message: 'Error creating solicitud' });
  }
});

module.exports = router;
