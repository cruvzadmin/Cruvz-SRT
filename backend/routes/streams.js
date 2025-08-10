const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation schemas
const createStreamSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).optional(),
  protocol: Joi.string().valid('rtmp', 'srt', 'webrtc').default('rtmp'),
  source_url: Joi.string().uri().required(),
  destination_url: Joi.string().uri().required(),
  settings: Joi.object({
    quality: Joi.string().valid('720p', '1080p', '4k').default('1080p'),
    bitrate: Joi.number().min(1000).max(50000).default(5000),
    fps: Joi.number().valid(24, 30, 60).default(30),
    audio_bitrate: Joi.number().min(64).max(320).default(128)
  }).optional(),
  max_viewers: Joi.number().min(1).max(100000).default(1000),
  is_recording: Joi.boolean().default(false)
});

const updateStreamSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional(),
  description: Joi.string().max(1000).optional(),
  source_url: Joi.string().uri().optional(),
  destination_url: Joi.string().uri().optional(),
  settings: Joi.object({
    quality: Joi.string().valid('720p', '1080p', '4k'),
    bitrate: Joi.number().min(1000).max(50000),
    fps: Joi.number().valid(24, 30, 60),
    audio_bitrate: Joi.number().min(64).max(320)
  }).optional(),
  max_viewers: Joi.number().min(1).max(100000).optional(),
  is_recording: Joi.boolean().optional()
});

// Generate stream key
const generateStreamKey = () => {
  return `stream_${uuidv4().replace(/-/g, '')}`;
};

// Get default port for protocol
const getDefaultPort = (protocol) => {
  switch(protocol) {
    case 'rtmp': return 1935;
    case 'srt': return 9999;
    case 'webrtc': return 3333;
    default: return 1935;
  }
};

// @route   GET /api/streams
// @desc    Get all streams for user
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, protocol } = req.query;
    const offset = (page - 1) * limit;

    let query = db('streams')
      .select('*')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (status) {
      query = query.where({ status });
    }

    if (protocol) {
      query = query.where({ protocol });
    }

    const streams = await query;

    // Get total count
    let countQuery = db('streams')
      .count('id as total')
      .where({ user_id: req.user.id });

    if (status) {
      countQuery = countQuery.where({ status });
    }

    if (protocol) {
      countQuery = countQuery.where({ protocol });
    }

    const [{ total }] = await countQuery;

    res.json({
      success: true,
      data: {
        streams,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_items: total,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get streams error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/streams/:id
// @desc    Get single stream
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const stream = await db('streams')
      .where({ 
        id: req.params.id, 
        user_id: req.user.id 
      })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Get latest analytics
    const analytics = await db('stream_analytics')
      .where({ stream_id: stream.id })
      .orderBy('recorded_at', 'desc')
      .first();

    res.json({
      success: true,
      data: {
        ...stream,
        analytics
      }
    });
  } catch (error) {
    logger.error('Get stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/streams
// @desc    Create new stream
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { error, value } = createStreamSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Check stream limit based on user role
    const userStreams = await db('streams')
      .where({ user_id: req.user.id, status: 'live' })
      .count('id as count');

    const maxStreams = req.user.role === 'admin' ? 100 : req.user.role === 'premium' ? 10 : 3;
    
    if (userStreams[0].count >= maxStreams) {
      return res.status(400).json({
        success: false,
        error: `Maximum concurrent streams limit reached (${maxStreams})`
      });
    }

    const streamKey = generateStreamKey();

    const [streamId] = await db('streams').insert({
      user_id: req.user.id,
      title: value.title,
      description: value.description,
      stream_key: streamKey,
      protocol: value.protocol,
      source_url: value.source_url,
      destination_url: value.destination_url,
      settings: JSON.stringify(value.settings || {}),
      max_viewers: value.max_viewers,
      is_recording: value.is_recording,
      status: 'inactive'
    });

    const stream = await db('streams')
      .where({ id: streamId })
      .first();

    logger.info(`Stream created: ${stream.title} by user ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: stream
    });
  } catch (error) {
    logger.error('Create stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   PUT /api/streams/:id
// @desc    Update stream
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const { error, value } = updateStreamSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const stream = await db('streams')
      .where({ 
        id: req.params.id, 
        user_id: req.user.id 
      })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    if (stream.status === 'live') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update live stream'
      });
    }

    const updateData = { ...value };
    if (updateData.settings) {
      updateData.settings = JSON.stringify(updateData.settings);
    }
    updateData.updated_at = new Date();

    await db('streams')
      .where({ id: req.params.id })
      .update(updateData);

    const updatedStream = await db('streams')
      .where({ id: req.params.id })
      .first();

    logger.info(`Stream updated: ${updatedStream.title} by user ${req.user.email}`);

    res.json({
      success: true,
      data: updatedStream
    });
  } catch (error) {
    logger.error('Update stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/streams/:id/start
// @desc    Start stream
// @access  Private
router.post('/:id/start', auth, async (req, res) => {
  try {
    const stream = await db('streams')
      .where({ 
        id: req.params.id, 
        user_id: req.user.id 
      })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    if (stream.status === 'live') {
      return res.status(400).json({
        success: false,
        error: 'Stream is already live'
      });
    }

    await db('streams')
      .where({ id: req.params.id })
      .update({
        status: 'live',
        started_at: new Date(),
        ended_at: null
      });

    // Initialize analytics record
    await db('stream_analytics').insert({
      stream_id: stream.id,
      current_viewers: 0,
      peak_viewers: 0,
      total_viewers: 0,
      duration_seconds: 0,
      recorded_at: new Date()
    });

    logger.info(`Stream started: ${stream.title} by user ${req.user.email}`);

    // Use custom URLs if provided, otherwise generate default URLs
    const streamUrls = {
      stream_key: stream.stream_key,
      source_url: stream.source_url || `${stream.protocol}://localhost:${getDefaultPort(stream.protocol)}/app/${stream.stream_key}`,
      destination_url: stream.destination_url || `${stream.protocol}://localhost:${getDefaultPort(stream.protocol)}/app/${stream.stream_key}`
    };

    // Also include the legacy URL format for backward compatibility
    if (stream.protocol === 'rtmp') {
      streamUrls.rtmp_url = stream.destination_url || `rtmp://localhost:1935/app/${stream.stream_key}`;
    } else if (stream.protocol === 'srt') {
      streamUrls.srt_url = stream.destination_url || `srt://localhost:9999?streamid=${stream.stream_key}`;
    } else if (stream.protocol === 'webrtc') {
      streamUrls.webrtc_url = stream.destination_url || `http://localhost:3333/app/${stream.stream_key}`;
    }

    res.json({
      success: true,
      message: 'Stream started successfully',
      data: streamUrls
    });
  } catch (error) {
    logger.error('Start stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/streams/:id/stop
// @desc    Stop stream
// @access  Private
router.post('/:id/stop', auth, async (req, res) => {
  try {
    const stream = await db('streams')
      .where({ 
        id: req.params.id, 
        user_id: req.user.id 
      })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    if (stream.status !== 'live') {
      return res.status(400).json({
        success: false,
        error: 'Stream is not live'
      });
    }

    await db('streams')
      .where({ id: req.params.id })
      .update({
        status: 'ended',
        ended_at: new Date()
      });

    logger.info(`Stream stopped: ${stream.title} by user ${req.user.email}`);

    res.json({
      success: true,
      message: 'Stream stopped successfully'
    });
  } catch (error) {
    logger.error('Stop stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   DELETE /api/streams/:id
// @desc    Delete stream
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const stream = await db('streams')
      .where({ 
        id: req.params.id, 
        user_id: req.user.id 
      })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    if (stream.status === 'live') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete live stream'
      });
    }

    await db('streams')
      .where({ id: req.params.id })
      .del();

    logger.info(`Stream deleted: ${stream.title} by user ${req.user.email}`);

    res.json({
      success: true,
      message: 'Stream deleted successfully'
    });
  } catch (error) {
    logger.error('Delete stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;