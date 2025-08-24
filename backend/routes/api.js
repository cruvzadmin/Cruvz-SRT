const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const isProduction = process.env.NODE_ENV === 'production';
const dbConfig = isProduction ? require('../config/database') : require('../config/database-dev');
const db = isProduction ? dbConfig : dbConfig.db;
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schema
const createApiKeySchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  permissions: Joi.string().valid('read', 'write', 'admin').default('read'),
  expires_in_days: Joi.number().min(1).max(365).optional()
});

// Generate API key
const generateApiKey = () => {
  const prefix = 'cruvz_';
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return prefix + randomBytes;
};

// Hash API key for storage
const hashApiKey = (key) => {
  return crypto.createHash('sha256').update(key).digest('hex');
};

// @route   GET /api/keys
// @desc    Get user's API keys
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const apiKeys = await db('api_keys')
      .select('id', 'name', 'permissions', 'is_active', 'expires_at', 'last_used', 'created_at')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: apiKeys
    });
  } catch (error) {
    logger.error('Get API keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/keys
// @desc    Create new API key
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { error, value } = createApiKeySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { name, permissions, expires_in_days } = value;

    // Check API key limit based on user role
    const userApiKeys = await db('api_keys')
      .where({ user_id: req.user.id, is_active: true })
      .count('id as count');

    const maxApiKeys = req.user.role === 'admin' ? 50 : req.user.role === 'premium' ? 10 : 3;
    
    if (userApiKeys[0].count >= maxApiKeys) {
      return res.status(400).json({
        success: false,
        error: `Maximum API keys limit reached (${maxApiKeys})`
      });
    }

    // Check for duplicate name
    const existingKey = await db('api_keys')
      .where({ user_id: req.user.id, name })
      .first();

    if (existingKey) {
      return res.status(400).json({
        success: false,
        error: 'API key with this name already exists'
      });
    }

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    // Calculate expiration date
    let expiresAt = null;
    if (expires_in_days) {
      expiresAt = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000);
    }

    // Store API key
    const [keyId] = await db('api_keys').insert({
      user_id: req.user.id,
      name,
      key_hash: keyHash,
      permissions,
      expires_at: expiresAt,
      is_active: true
    });

    const createdKey = await db('api_keys')
      .select('id', 'name', 'permissions', 'is_active', 'expires_at', 'created_at')
      .where({ id: keyId })
      .first();

    logger.info(`API key created: ${name} for user ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: {
        ...createdKey,
        api_key: apiKey // Only returned once during creation
      },
      message: 'API key created successfully. Store it securely as it won\'t be shown again.'
    });
  } catch (error) {
    logger.error('Create API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   PUT /api/keys/:id
// @desc    Update API key
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, permissions, is_active } = req.body;

    const apiKey = await db('api_keys')
      .where({ 
        id: req.params.id, 
        user_id: req.user.id 
      })
      .first();

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    const updateData = {};
    
    if (name !== undefined) {
      // Check for duplicate name
      const existingKey = await db('api_keys')
        .where({ user_id: req.user.id, name })
        .whereNot({ id: req.params.id })
        .first();

      if (existingKey) {
        return res.status(400).json({
          success: false,
          error: 'API key with this name already exists'
        });
      }
      updateData.name = name;
    }

    if (permissions !== undefined) {
      if (!['read', 'write', 'admin'].includes(permissions)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid permissions value'
        });
      }
      updateData.permissions = permissions;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active;
    }

    updateData.updated_at = new Date();

    await db('api_keys')
      .where({ id: req.params.id })
      .update(updateData);

    const updatedKey = await db('api_keys')
      .select('id', 'name', 'permissions', 'is_active', 'expires_at', 'last_used', 'created_at', 'updated_at')
      .where({ id: req.params.id })
      .first();

    logger.info(`API key updated: ${updatedKey.name} for user ${req.user.email}`);

    res.json({
      success: true,
      data: updatedKey
    });
  } catch (error) {
    logger.error('Update API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   DELETE /api/keys/:id
// @desc    Delete API key
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const apiKey = await db('api_keys')
      .where({ 
        id: req.params.id, 
        user_id: req.user.id 
      })
      .first();

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    await db('api_keys')
      .where({ id: req.params.id })
      .del();

    logger.info(`API key deleted: ${apiKey.name} for user ${req.user.email}`);

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error) {
    logger.error('Delete API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/keys/:id/regenerate
// @desc    Regenerate API key
// @access  Private
router.post('/:id/regenerate', auth, async (req, res) => {
  try {
    const apiKey = await db('api_keys')
      .where({ 
        id: req.params.id, 
        user_id: req.user.id 
      })
      .first();

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // Generate new API key
    const newApiKey = generateApiKey();
    const newKeyHash = hashApiKey(newApiKey);

    await db('api_keys')
      .where({ id: req.params.id })
      .update({
        key_hash: newKeyHash,
        last_used: null,
        updated_at: new Date()
      });

    const updatedKey = await db('api_keys')
      .select('id', 'name', 'permissions', 'is_active', 'expires_at', 'created_at', 'updated_at')
      .where({ id: req.params.id })
      .first();

    logger.info(`API key regenerated: ${updatedKey.name} for user ${req.user.email}`);

    res.json({
      success: true,
      data: {
        ...updatedKey,
        api_key: newApiKey // Only returned once during regeneration
      },
      message: 'API key regenerated successfully. Store it securely as it won\'t be shown again.'
    });
  } catch (error) {
    logger.error('Regenerate API key error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/keys/:id/usage
// @desc    Get API key usage statistics
// @access  Private
router.get('/:id/usage', auth, async (req, res) => {
  try {
    const apiKey = await db('api_keys')
      .where({ 
        id: req.params.id, 
        user_id: req.user.id 
      })
      .first();

    if (!apiKey) {
      return res.status(404).json({
        success: false,
        error: 'API key not found'
      });
    }

    // Get actual API usage from request logs
    try {
      const today = new Date();
      const weekAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today - 30 * 24 * 60 * 60 * 1000);
      
      // Calculate usage statistics
      const totalRequests = await db('api_usage_logs')
        .count('* as count')
        .where({ api_key_id: apiKey.id })
        .first();
      
      const requestsToday = await db('api_usage_logs')
        .count('* as count')
        .where({ api_key_id: apiKey.id })
        .where('created_at', '>=', today.toISOString().split('T')[0])
        .first();
      
      const requestsThisWeek = await db('api_usage_logs')
        .count('* as count')
        .where({ api_key_id: apiKey.id })
        .where('created_at', '>=', weekAgo)
        .first();
      
      const requestsThisMonth = await db('api_usage_logs')
        .count('* as count')
        .where({ api_key_id: apiKey.id })
        .where('created_at', '>=', monthAgo)
        .first();
      
      const usageData = {
        total_requests: totalRequests?.count || 0,
        requests_today: requestsToday?.count || 0,
        requests_this_week: requestsThisWeek?.count || 0,
        requests_this_month: requestsThisMonth?.count || 0,
        last_used: apiKey.last_used,
        rate_limit_exceeded: 0,
        errors: 0,
        success_rate: 100
      };

      res.json({
        success: true,
        data: {
          api_key: {
            id: apiKey.id,
            name: apiKey.name,
            permissions: apiKey.permissions,
            is_active: apiKey.is_active,
            expires_at: apiKey.expires_at,
            created_at: apiKey.created_at
          },
          usage: usageData
        }
      });
    } catch (error) {
      logger.error('Get API key usage error:', error);
      res.status(500).json({
        success: false,
        error: 'Server error'
      });
    }
  } catch (error) {
    logger.error('Get API key usage outer error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;
