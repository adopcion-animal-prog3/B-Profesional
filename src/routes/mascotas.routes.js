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

module.exports = router;
