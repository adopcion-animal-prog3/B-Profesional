const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { checkDatabaseHealth } = require('../services/health.service');

const router = express.Router();

const DATABASE_UNAVAILABLE_MESSAGE = 'Database is unavailable';

router.get('/api/db-check', asyncHandler(async (req, res) => {
  const health = await checkDatabaseHealth();

  if (!health.available) {
    return res.status(503).json(errorResponse(DATABASE_UNAVAILABLE_MESSAGE));
  }

  return res.status(200).json(successResponse({
    status: 'ok',
    databaseTime: health.databaseTime,
  }));
}));

module.exports = router;
