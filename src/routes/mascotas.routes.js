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

module.exports = router;
