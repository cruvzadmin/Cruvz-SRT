const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  avatar_url: Joi.string().uri().optional(),
  preferences: Joi.object().optional()
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])')).required()
});

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await db('users')
      .select('id', 'name', 'email', 'role', 'avatar_url', 'preferences', 'last_login', 'created_at')
      .where({ id: req.user.id })
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user streams count
    const streamsCount = await db('streams')
      .count('* as total')
      .where({ user_id: req.user.id });

    // Get active streams count
    const activeStreamsCount = await db('streams')
      .count('* as active')
      .where({ user_id: req.user.id, status: 'live' });

    res.json({
      success: true,
      data: {
        ...user,
        statistics: {
          total_streams: streamsCount[0].total,
          active_streams: activeStreamsCount[0].active
        }
      }
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const updateData = { ...value };
    if (updateData.preferences) {
      updateData.preferences = JSON.stringify(updateData.preferences);
    }
    updateData.updated_at = new Date();

    await db('users')
      .where({ id: req.user.id })
      .update(updateData);

    const updatedUser = await db('users')
      .select('id', 'name', 'email', 'role', 'avatar_url', 'preferences', 'last_login', 'created_at', 'updated_at')
      .where({ id: req.user.id })
      .first();

    logger.info(`User profile updated: ${req.user.email}`);

    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    logger.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   PUT /api/users/password
// @desc    Change user password
// @access  Private
router.put('/password', auth, async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { current_password, new_password } = value;

    // Get current user with password
    const user = await db('users')
      .where({ id: req.user.id })
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(new_password, salt);

    await db('users')
      .where({ id: req.user.id })
      .update({
        password: hashedPassword,
        updated_at: new Date()
      });

    logger.info(`Password changed for user: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/users
// @desc    Get all users (Admin only)
// @access  Private (Admin)
router.get('/', auth, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, role, status } = req.query;
    const offset = (page - 1) * limit;

    let query = db('users')
      .select('id', 'name', 'email', 'role', 'is_active', 'last_login', 'created_at')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (search) {
      query = query.where(function() {
        this.where('name', 'like', `%${search}%`)
          .orWhere('email', 'like', `%${search}%`);
      });
    }

    if (role) {
      query = query.where('role', role);
    }

    if (status) {
      query = query.where('is_active', status === 'active');
    }

    const users = await query;

    // Get total count
    let countQuery = db('users').count('* as total');

    if (search) {
      countQuery = countQuery.where(function() {
        this.where('name', 'like', `%${search}%`)
          .orWhere('email', 'like', `%${search}%`);
      });
    }

    if (role) {
      countQuery = countQuery.where('role', role);
    }

    if (status) {
      countQuery = countQuery.where('is_active', status === 'active');
    }

    const [{ total }] = await countQuery;

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_items: total,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   PUT /api/users/:id/role
// @desc    Update user role (Admin only)
// @access  Private (Admin)
router.put('/:id/role', auth, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'premium', 'moderator', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    const user = await db('users')
      .where({ id: req.params.id })
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    await db('users')
      .where({ id: req.params.id })
      .update({
        role,
        updated_at: new Date()
      });

    logger.info(`User role updated: ${user.email} -> ${role} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'User role updated successfully'
    });
  } catch (error) {
    logger.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   PUT /api/users/:id/status
// @desc    Update user status (Admin only)
// @access  Private (Admin)
router.put('/:id/status', auth, authorize('admin'), async (req, res) => {
  try {
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'is_active must be boolean'
      });
    }

    const user = await db('users')
      .where({ id: req.params.id })
      .first();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change your own status'
      });
    }

    await db('users')
      .where({ id: req.params.id })
      .update({
        is_active,
        updated_at: new Date()
      });

    logger.info(`User status updated: ${user.email} -> ${is_active ? 'active' : 'inactive'} by ${req.user.email}`);

    res.json({
      success: true,
      message: 'User status updated successfully'
    });
  } catch (error) {
    logger.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;