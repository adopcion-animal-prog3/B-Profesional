const express = require('express');
const { successResponse } = require('../utils/apiResponse');
const { checkProcessHealth } = require('../services/health.service');

const router = express.Router();

router.get('/health', (req, res) => {
  return res.status(200).json(successResponse(checkProcessHealth()));
});

module.exports = router;
