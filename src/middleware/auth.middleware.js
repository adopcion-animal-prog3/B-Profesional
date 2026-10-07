const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ status: 'error', message: 'Authentication required' });
  }

  const [scheme, token] = authHeader.split(' ');

  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return res.status(401).json({ status: 'error', message: 'Invalid authorization header' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (typeof jwtSecret !== 'string' || jwtSecret.trim() === '') {
    console.error('JWT_SECRET is not configured');
    return res.status(500).json({ status: 'error', message: 'Authentication service is not configured' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    req.user = decoded;
    return next();
  } catch (error) {
    if (error && error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'error', message: 'Token expired' });
    }

    return res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
};

module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
