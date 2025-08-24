const jwt = require('jsonwebtoken');
const db = require('../config/database-fallback');
const logger = require('../utils/logger');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token, authorization denied'
      });
    }

    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET is not set in environment variables.');
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'is_active', 'last_login_at')
      .where({ id: decoded.id })
      .first();

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Token is not valid - user not found'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('JWT token expired:', error);
      return res.status(401).json({
        success: false,
        error: 'Token expired, please login again'
      });
    }
    logger.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      error: 'Token is not valid'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied - no user context'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied - requires role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

module.exports = { auth, authorize };
