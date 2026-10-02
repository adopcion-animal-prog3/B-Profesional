const express = require('express');
const { query } = require('../config/database');

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
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ status: 'error', message: 'Request body is required' });
  }

  const { nombre, especie, raza, edad, sexo, descripcion, adoptada, creado_por } = body;
  const validationError = validateMascota(body);
  if (validationError) {
    return res.status(400).json({ status: 'error', message: validationError });
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

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ status: 'error', message: 'Request body is required' });
  }

  const { nombre, especie, raza, edad, sexo, descripcion, adoptada } = body;
  const validationError = validateMascota(body, true);
  if (validationError) {
    return res.status(400).json({ status: 'error', message: validationError });
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

