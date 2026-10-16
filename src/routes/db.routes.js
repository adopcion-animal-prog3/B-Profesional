const express = require('express');
const { query } = require('../config/database');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

router.get('/api/db-check', asyncHandler(async (req, res) => {
  const result = await query('SELECT NOW() AS current_time');
  const databaseTime = result.rows[0]?.current_time;

  return res.status(200).json(successResponse({ databaseTime }));
}));

module.exports = router;
