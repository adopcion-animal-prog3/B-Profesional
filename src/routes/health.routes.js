const express = require('express');
const { successResponse } = require('../utils/apiResponse');

const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json(successResponse({ status: 'ok' }));
});

module.exports = router;
