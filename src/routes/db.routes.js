const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

router.get('/api/db-check', async (req, res) => {
  try {
    const result = await query('SELECT NOW() AS current_time');
    const databaseTime = result.rows[0]?.current_time;

    return res.status(200).json({
      status: 'ok',
      databaseTime,
    });
  } catch (error) {
    return res.status(503).json({
      status: 'error',
      message: 'Database unavailable',
    });
  }
});

module.exports = router;
