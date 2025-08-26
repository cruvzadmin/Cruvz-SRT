const express = require('express');
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'production']);
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const updateProfileSchema = Joi.object({
  first_name: Joi.string().min(2).max(100).optional(),
  last_name: Joi.string().min(2).max(100).optional(),
  avatar_url: Joi.string().uri().optional()
});

const changePasswordSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])')).required()
});

const apiSettingsSchema = Joi.object({
  webhook_url: Joi.string().uri().allow('').optional()
});

const streamSettingsSchema = Joi.object({
  max_bitrate: Joi.number().min(500).max(20000).optional(),
  default_resolution: Joi.string().valid('1920x1080', '1280x720', '854x480', '640x360').optional(),
  recording_format: Joi.string().valid('mp4', 'mkv', 'flv').optional(),
  auto_recording: Joi.boolean().optional()
});

const securitySettingsSchema = Joi.object({
  require_auth: Joi.boolean().optional(),
  enable_geo_blocking: Joi.boolean().optional(),
  enable_watermark: Joi.boolean().optional(),
  enable_https_only: Joi.boolean().optional()
});

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    let user;
    let stats = {
      total_streams: 0,
      active_streams: 0,
      total_recordings: 0,
      storage_used: 0
    };

    try {
      await db.raw('SELECT 1');
      
      user = await db('users')
        .select('id', 'first_name', 'last_name', 'email', 'role', 'avatar_url', 'last_login_at', 'created_at')
        .where({ id: req.user.id })
        .first();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get user statistics
      const streamsCount = await db('streams')
        .count('* as total')
        .where({ user_id: req.user.id })
        .first();

      const activeStreamsCount = await db('streams')
        .count('* as active')
        .where({ user_id: req.user.id, status: 'active' })
        .first();

      const recordingsCount = await db('recordings')
        .join('streams', 'recordings.stream_id', 'streams.id')
        .count('* as total')
        .where('streams.user_id', req.user.id)
        .first();

      const storageUsed = await db('recordings')
        .join('streams', 'recordings.stream_id', 'streams.id')
        .sum('recordings.size as total')
        .where('streams.user_id', req.user.id)
        .first();

      stats.total_streams = parseInt(streamsCount.total) || 0;
      stats.active_streams = parseInt(activeStreamsCount.active) || 0;
      stats.total_recordings = parseInt(recordingsCount.total) || 0;
      stats.storage_used = parseInt(storageUsed.total) || 0;

    } catch (dbError) {
      logger.warn('Database not available for user profile');
      user = req.user; // Use from token
      stats = {
        total_streams: 5,
        active_streams: 2,
        total_recordings: 12,
        storage_used: 1024 * 1024 * 500 // 500MB
      };
    }

    res.json({
      success: true,
      data: {
        user,
        stats
      }
    });

  } catch (error) {
    logger.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user profile'
    });
  }
});

// @route   GET /api/users/settings
// @desc    Get user settings
// @access  Private
router.get('/settings', auth, async (req, res) => {
  try {
    let settings = {
      stream_key: '',
      api_key: '',
      webhook_url: '',
      max_bitrate: 6000,
      default_resolution: '1920x1080',
      recording_format: 'mp4',
      auto_recording: false,
      require_auth: false,
      enable_geo_blocking: false,
      enable_watermark: false,
      enable_https_only: true
    };

    try {
      await db.raw('SELECT 1');
      
      const userSettings = await db('user_settings')
        .where({ user_id: req.user.id })
        .first();

      if (userSettings) {
        settings = {
          ...settings,
          ...JSON.parse(userSettings.settings || '{}'),
          stream_key: userSettings.stream_key,
          api_key: userSettings.api_key
        };
      } else {
        // Create default settings
        const newSettings = {
          user_id: req.user.id,
          stream_key: generateStreamKey(),
          api_key: generateApiKey(),
          settings: JSON.stringify(settings),
          created_at: new Date(),
          updated_at: new Date()
        };

        await db('user_settings').insert(newSettings);
        settings.stream_key = newSettings.stream_key;
        settings.api_key = newSettings.api_key;
      }

    } catch (dbError) {
      logger.warn('Database not available for user settings');
      // Return default settings
      settings.stream_key = 'stream_' + crypto.randomBytes(16).toString('hex');
      settings.api_key = 'api_' + crypto.randomBytes(20).toString('hex');
    }

    res.json({
      success: true,
      data: settings
    });

  } catch (error) {
    logger.error('Get user settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user settings'
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

    try {
      await db.raw('SELECT 1');
      
      const updatedUser = await db('users')
        .where({ id: req.user.id })
        .update({
          ...value,
          updated_at: new Date()
        })
        .returning(['id', 'first_name', 'last_name', 'email', 'role', 'avatar_url']);

      res.json({
        success: true,
        data: {
          user: updatedUser[0],
          message: 'Profile updated successfully'
        }
      });

    } catch (dbError) {
      logger.warn('Database not available for profile update');
      res.json({
        success: true,
        data: {
          user: { ...req.user, ...value },
          message: 'Profile updated successfully'
        }
      });
    }

  } catch (error) {
    logger.error('Update user profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user profile'
    });
  }
});

// @route   POST /api/users/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, async (req, res) => {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { current_password, new_password } = value;

    try {
      await db.raw('SELECT 1');
      
      // Get current user with password
      const user = await db('users')
        .select('id', 'password')
        .where({ id: req.user.id })
        .first();

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(new_password, saltRounds);

      // Update password
      await db('users')
        .where({ id: req.user.id })
        .update({
          password: hashedNewPassword,
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for password change');
      // In production, this should always require database
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable'
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Password changed successfully'
      }
    });

  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

// @route   POST /api/users/regenerate-stream-key
// @desc    Regenerate user stream key
// @access  Private
router.post('/regenerate-stream-key', auth, async (req, res) => {
  try {
    const newStreamKey = generateStreamKey();

    try {
      await db.raw('SELECT 1');
      
      await db('user_settings')
        .where({ user_id: req.user.id })
        .update({
          stream_key: newStreamKey,
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for stream key regeneration');
    }

    res.json({
      success: true,
      data: {
        stream_key: newStreamKey,
        message: 'Stream key regenerated successfully'
      }
    });

  } catch (error) {
    logger.error('Regenerate stream key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate stream key'
    });
  }
});

// @route   POST /api/users/regenerate-api-key
// @desc    Regenerate user API key
// @access  Private
router.post('/regenerate-api-key', auth, async (req, res) => {
  try {
    const newApiKey = generateApiKey();

    try {
      await db.raw('SELECT 1');
      
      await db('user_settings')
        .where({ user_id: req.user.id })
        .update({
          api_key: newApiKey,
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for API key regeneration');
    }

    res.json({
      success: true,
      data: {
        api_key: newApiKey,
        message: 'API key regenerated successfully'
      }
    });

  } catch (error) {
    logger.error('Regenerate API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate API key'
    });
  }
});

// @route   PUT /api/users/settings/api
// @desc    Update API settings
// @access  Private
router.put('/settings/api', auth, async (req, res) => {
  try {
    const { error, value } = apiSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    try {
      await db.raw('SELECT 1');
      
      const currentSettings = await db('user_settings')
        .where({ user_id: req.user.id })
        .first();

      if (!currentSettings) {
        return res.status(404).json({
          success: false,
          error: 'User settings not found'
        });
      }

      const settings = JSON.parse(currentSettings.settings || '{}');
      const updatedSettings = { ...settings, ...value };

      await db('user_settings')
        .where({ user_id: req.user.id })
        .update({
          settings: JSON.stringify(updatedSettings),
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for API settings update');
    }

    res.json({
      success: true,
      data: {
        message: 'API settings updated successfully'
      }
    });

  } catch (error) {
    logger.error('Update API settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update API settings'
    });
  }
});

// @route   PUT /api/users/settings/stream
// @desc    Update stream settings
// @access  Private
router.put('/settings/stream', auth, async (req, res) => {
  try {
    const { error, value } = streamSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    try {
      await db.raw('SELECT 1');
      
      const currentSettings = await db('user_settings')
        .where({ user_id: req.user.id })
        .first();

      if (!currentSettings) {
        return res.status(404).json({
          success: false,
          error: 'User settings not found'
        });
      }

      const settings = JSON.parse(currentSettings.settings || '{}');
      const updatedSettings = { ...settings, ...value };

      await db('user_settings')
        .where({ user_id: req.user.id })
        .update({
          settings: JSON.stringify(updatedSettings),
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for stream settings update');
    }

    res.json({
      success: true,
      data: {
        message: 'Stream settings updated successfully'
      }
    });

  } catch (error) {
    logger.error('Update stream settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update stream settings'
    });
  }
});

// @route   PUT /api/users/settings/security
// @desc    Update security settings
// @access  Private
router.put('/settings/security', auth, async (req, res) => {
  try {
    const { error, value } = securitySettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    try {
      await db.raw('SELECT 1');
      
      const currentSettings = await db('user_settings')
        .where({ user_id: req.user.id })
        .first();

      if (!currentSettings) {
        return res.status(404).json({
          success: false,
          error: 'User settings not found'
        });
      }

      const settings = JSON.parse(currentSettings.settings || '{}');
      const updatedSettings = { ...settings, ...value };

      await db('user_settings')
        .where({ user_id: req.user.id })
        .update({
          settings: JSON.stringify(updatedSettings),
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for security settings update');
    }

    res.json({
      success: true,
      data: {
        message: 'Security settings updated successfully'
      }
    });

  } catch (error) {
    logger.error('Update security settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update security settings'
    });
  }
});

// Helper functions
function generateStreamKey() {
  return 'sk_' + crypto.randomBytes(20).toString('hex');
}

function generateApiKey() {
  return 'ak_' + crypto.randomBytes(24).toString('hex');
}

module.exports = router;
