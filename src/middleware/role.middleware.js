const requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    // If authentication middleware wasn't executed, deny as unauthenticated
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Authentication required' });
    }

    const userRole = req.user.rol || req.user.role || null;
    if (!userRole || typeof userRole !== 'string') {
      return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
    }

    return next();
  };
};

module.exports = requireRole;
