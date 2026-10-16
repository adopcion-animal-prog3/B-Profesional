const { errorResponse } = require('../utils/apiResponse');

const requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(errorResponse('Authentication required'));
    }

    const userRole = req.user.rol || req.user.role || null;
    if (!userRole || typeof userRole !== 'string') {
      return res.status(403).json(errorResponse('Insufficient permissions'));
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json(errorResponse('Insufficient permissions'));
    }

    return next();
  };
};

module.exports = requireRole;
