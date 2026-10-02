const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

router.get('/api/mascotas', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at FROM mascotas'
    );

    return res.status(200).json({
      status: 'success',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Error fetching mascotas:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving mascotas from database',
    });
  }
});

// GET /api/mascotas/:id — obtener una mascota por id
router.get('/api/mascotas/:id', async (req, res) => {
  const { id } = req.params;

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid id parameter',
    });
  }

  try {
    const result = await query(
      'SELECT id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at FROM mascotas WHERE id = $1',
      [numericId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Mascota not found',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching mascota by id:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Error retrieving mascota from database',
    });
  }
});

// POST /api/mascotas — crear nueva mascota
router.post('/api/mascotas', async (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Request body is required' });
  }

  const { nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por } = body;

  // Validaciones básicas
  if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Field "nombre" is required' });
  }
  if (!especie || typeof especie !== 'string' || especie.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Field "especie" is required' });
  }
  if (edad !== undefined && (!Number.isInteger(edad) || edad < 0)) {
    return res.status(400).json({ status: 'error', message: 'Field "edad" must be a non-negative integer' });
  }
  if (sexo !== undefined && !['M', 'F', 'OTRO'].includes(sexo)) {
    return res.status(400).json({ status: 'error', message: 'Field "sexo" must be one of M, F, OTRO' });
  }
  if (adoptada !== undefined && typeof adoptada !== 'boolean') {
    return res.status(400).json({ status: 'error', message: 'Field "adoptada" must be boolean' });
  }

  try {
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

    return res.status(201).json({ status: 'success', data: created });
  } catch (error) {
    console.error('Error creating mascota:', error.message);
    return res.status(500).json({ status: 'error', message: 'Error creating mascota in database' });
  }
});

// PUT /api/mascotas/:id — actualizar una mascota existente
router.put('/api/mascotas/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({ status: 'error', message: 'Invalid id parameter' });
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ status: 'error', message: 'Request body is required' });
  }

  const { nombre, especie, raza, edad, sexo, descripcion, adoptada } = body;

  // Basic validations for provided fields
  if (nombre !== undefined && (typeof nombre !== 'string' || nombre.trim() === '')) {
    return res.status(400).json({ status: 'error', message: 'Field "nombre" must be a non-empty string' });
  }
  if (especie !== undefined && (typeof especie !== 'string' || especie.trim() === '')) {
    return res.status(400).json({ status: 'error', message: 'Field "especie" must be a non-empty string' });
  }
  if (edad !== undefined && (!Number.isInteger(edad) || edad < 0)) {
    return res.status(400).json({ status: 'error', message: 'Field "edad" must be a non-negative integer' });
  }
  if (sexo !== undefined && !['M', 'F', 'OTRO'].includes(sexo)) {
    return res.status(400).json({ status: 'error', message: 'Field "sexo" must be one of M, F, OTRO' });
  }
  if (adoptada !== undefined && typeof adoptada !== 'boolean') {
    return res.status(400).json({ status: 'error', message: 'Field "adoptada" must be boolean' });
  }

  try {
    // Check existence
    const exists = await query('SELECT id FROM mascotas WHERE id = $1', [numericId]);
    if (!exists.rows || exists.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Mascota not found' });
    }

    // Build dynamic update based on provided fields
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
      return res.status(200).json({ status: 'success', data: current.rows[0] });
    }

    const updateQuery = `UPDATE mascotas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at`;
    params.push(numericId);

    const result = await query(updateQuery, params);
    const updated = result.rows[0];

    return res.status(200).json({ status: 'success', data: updated });
  } catch (error) {
    console.error('Error updating mascota:', error.message);
    return res.status(500).json({ status: 'error', message: 'Error updating mascota in database' });
  }
});

router.delete('/api/mascotas/:id', async (req, res) => {
  const { id } = req.params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return res.status(400).json({ status: 'error', message: 'Invalid id parameter' });
  }

  try {
    const exists = await query('SELECT id FROM mascotas WHERE id = $1', [numericId]);
    if (!exists.rows || exists.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Mascota not found' });
    }

    const result = await query('DELETE FROM mascotas WHERE id = $1 RETURNING id, nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por, created_at', [numericId]);

    return res.status(200).json({
      status: 'success',
      message: 'Mascota deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting mascota:', error.message);
    return res.status(500).json({ status: 'error', message: 'Error deleting mascota from database' });
  }
});

module.exports = router;

