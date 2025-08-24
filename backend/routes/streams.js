const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const isProduction = process.env.NODE_ENV === 'production';
const dbConfig = isProduction ? require('../config/database') : require('../config/database-dev');
const db = isProduction ? dbConfig : dbConfig.db;
const cache = require('../utils/cache');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/streams/public
// @desc    Get public streams list (live streams only)
// @access  Public
router.get('/public', async (req, res) => {
  try {
    let streams = [];

    // Try to get real data from database if available
    try {
      await db.raw('SELECT 1');
      
      // Get live streams with basic info (no sensitive data)
      streams = await db('streams')
        .join('users', 'streams.user_id', 'users.id')
        .select(
          'streams.id',
          'streams.title',
          'streams.description',
          'streams.protocol',
          'streams.current_viewers',
          'streams.started_at',
          'users.name as streamer_name'
        )
        .where('streams.status', 'live')
        .orderBy('streams.current_viewers', 'desc')
        .limit(20);
      
    } catch (dbError) {
      logger.warn('Database unavailable for public streams list');
      // Return empty list
    }

    res.json({
      success: true,
      data: streams
    });
  } catch (error) {
    logger.error('Public streams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch streams'
    });
  }
});

// Validation schemas optimized for production streaming
const createStreamSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(1000).optional(),
  protocol: Joi.string().valid('rtmp', 'srt', 'webrtc').default('rtmp'),
  source_url: Joi.string().uri().allow('').optional(),
  destination_url: Joi.string().uri().allow('').optional(),
  settings: Joi.object({
    quality: Joi.string().valid('720p', '1080p', '4k').default('1080p'),
    bitrate: Joi.number().min(1000).max(50000).default(5000),
    fps: Joi.number().valid(24, 30, 60).default(30),
    audio_bitrate: Joi.number().min(64).max(320).default(128),
    enable_transcoding: Joi.boolean().default(true),
    adaptive_bitrate: Joi.boolean().default(true)
  }).optional(),
  max_viewers: Joi.number().min(1).max(100000).default(10000),
  is_recording: Joi.boolean().default(false),
  auto_start: Joi.boolean().default(false),
  geographic_restrictions: Joi.array().items(Joi.string()).optional()
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
    audio_bitrate: Joi.number().min(64).max(320),
    enable_transcoding: Joi.boolean(),
    adaptive_bitrate: Joi.boolean()
  }).optional(),
  max_viewers: Joi.number().min(1).max(100000).optional(),
  is_recording: Joi.boolean().optional(),
  geographic_restrictions: Joi.array().items(Joi.string()).optional()
});

// Generate secure stream key
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

// Build streaming URLs for different protocols
const buildStreamingUrls = (protocol, streamKey) => {
  const originHost = process.env.ORIGIN_HOST || 'origin';
  const port = getDefaultPort(protocol);
  
  switch(protocol) {
  case 'rtmp':
    return {
      publish_url: `rtmp://${originHost}:${port}/live`,
      play_url: `rtmp://${originHost}:${port}/live/${streamKey}`,
      hls_url: `http://${originHost}:8080/live/${streamKey}/playlist.m3u8`,
      dash_url: `http://${originHost}:8080/live/${streamKey}/manifest.mpd`,
      webrtc_url: `ws://${originHost}:3333/live/${streamKey}`
    };
  case 'srt':
    return {
      publish_url: `srt://${originHost}:${port}?streamid=publish/${streamKey}`,
      play_url: `srt://${originHost}:${port}?streamid=play/${streamKey}`,
      hls_url: `http://${originHost}:8080/live/${streamKey}/playlist.m3u8`,
      dash_url: `http://${originHost}:8080/live/${streamKey}/manifest.mpd`
    };
  case 'webrtc':
    return {
      publish_url: `ws://${originHost}:3333/live/${streamKey}`,
      play_url: `ws://${originHost}:3333/live/${streamKey}`,
      hls_url: `http://${originHost}:8080/live/${streamKey}/playlist.m3u8`
    };
  default:
    return {};
  }
};

// @route   GET /api/streams
// @desc    Get all streams for user with caching
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, protocol } = req.query;
    const offset = (page - 1) * limit;
    const cacheKey = `user_streams:${req.user.id}:${page}:${limit}:${status || 'all'}:${protocol || 'all'}`;

    // Try to get from cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    let query = db('streams')
      .select('*')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    if (status) {
      query = query.where({ status });
    }

    if (protocol) {
      query = query.where({ protocol });
    }

    const streams = await query;

    // Get real-time viewer counts from cache
    for (const stream of streams) {
      if (stream.status === 'active') {
        stream.current_viewers = await cache.getViewerCount(stream.id);
      }
      
      // Add streaming URLs
      stream.streaming_urls = buildStreamingUrls(stream.protocol, stream.stream_key);
    }

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

    const responseData = {
      streams,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total: parseInt(total),
        total_pages: Math.ceil(total / limit)
      }
    };

    // Cache the result for 30 seconds
    await cache.set(cacheKey, responseData, 30);

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('Get streams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch streams'
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
      .where({ user_id: req.user.id, status: 'active' })
      .count('id as count');

    const maxStreams = req.user.role === 'admin' ? 100 : req.user.role === 'premium' ? 10 : 3;
    
    if (userStreams[0].count >= maxStreams) {
      return res.status(400).json({
        success: false,
        error: `Maximum concurrent streams limit reached (${maxStreams})`
      });
    }

    const streamKey = generateStreamKey();
    const streamId = uuidv4();

    await db('streams').insert({
      id: streamId,
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

    if (stream.status === 'active') {
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

    if (stream.status === 'active') {
      return res.status(400).json({
        success: false,
        error: 'Stream is already active'
      });
    }

    await db('streams')
      .where({ id: req.params.id })
      .update({
        status: 'active',
        started_at: new Date(),
        ended_at: null
      });

    // Initialize analytics record for today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const analyticsId = uuidv4();
    
    try {
      await db('stream_analytics').insert({
        id: analyticsId,
        stream_id: stream.id,
        date: today,
        unique_viewers: 0,
        total_views: 0,
        peak_concurrent_viewers: 0,
        total_watch_time: 0,
        avg_watch_duration: 0
      });
    } catch (error) {
      // Analytics record might already exist for today - that's fine
      logger.warn(`Analytics record already exists for stream ${stream.id} on ${today}`);
    }

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

    if (stream.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Stream is not active'
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

    if (stream.status === 'active') {
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