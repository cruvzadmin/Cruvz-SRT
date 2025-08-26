const express = require('express');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/database-service');
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
          'users.first_name as streamer_first_name',
          'users.last_name as streamer_last_name'
        )
        .where('streams.status', 'active')
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
    let cachedData = null;
    try {
      cachedData = await cache.get(cacheKey);
    } catch (error) {
      logger.warn('Cache get error:', error.message);
    }
    
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
        try {
          stream.current_viewers = await cache.getViewerCount(stream.id);
        } catch (error) {
          logger.warn('Cache getViewerCount error:', error.message);
          stream.current_viewers = 0;
        }
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
    try {
      await cache.set(cacheKey, responseData, 30);
    } catch (error) {
      logger.warn('Cache set error:', error.message);
    }

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
      .orderBy('created_at', 'desc')
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

// @route   GET /api/streams/:id/url
// @desc    Get stream URL
// @access  Private
router.get('/:id/url', auth, async (req, res) => {
  try {
    const streamId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const stream = await db('streams')
        .where({ id: streamId, user_id: req.user.id })
        .first();

      if (!stream) {
        return res.status(404).json({
          success: false,
          error: 'Stream not found'
        });
      }

      // Generate stream URLs based on protocol
      const baseUrl = process.env.STREAMING_BASE_URL || 'http://localhost:8080';
      const streamKey = stream.stream_key;
      
      let urls = {};
      
      switch (stream.protocol) {
      case 'rtmp':
        urls = {
          ingest: `rtmp://${baseUrl.replace('http://', '').replace('https://', '')}/live/${streamKey}`,
          watch: `${baseUrl}/live/${streamKey}/playlist.m3u8`
        };
        break;
      case 'webrtc':
        urls = {
          ingest: `ws://${baseUrl.replace('http://', '').replace('https://', '')}/webrtc/${streamKey}`,
          watch: `${baseUrl}/webrtc/${streamKey}`
        };
        break;
      case 'srt':
        urls = {
          ingest: `srt://${baseUrl.replace('http://', '').replace('https://', '')}:9999?streamid=${streamKey}`,
          watch: `${baseUrl}/srt/${streamKey}/playlist.m3u8`
        };
        break;
      case 'hls':
        urls = {
          ingest: `rtmp://${baseUrl.replace('http://', '').replace('https://', '')}/live/${streamKey}`,
          watch: `${baseUrl}/hls/${streamKey}/playlist.m3u8`
        };
        break;
      default:
        urls = {
          ingest: `rtmp://${baseUrl.replace('http://', '').replace('https://', '')}/live/${streamKey}`,
          watch: `${baseUrl}/live/${streamKey}/playlist.m3u8`
        };
      }

      res.json({
        success: true,
        data: {
          stream_id: streamId,
          protocol: stream.protocol,
          stream_key: streamKey,
          url: urls.watch,
          ingest_url: urls.ingest,
          watch_url: urls.watch
        }
      });

    } catch (dbError) {
      logger.warn('Database not available for stream URL');
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable'
      });
    }

  } catch (error) {
    logger.error('Get stream URL error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stream URL'
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

    const streamId = req.params.id;
    
    try {
      await db.raw('SELECT 1');
      
      // Check if stream exists and belongs to user
      const stream = await db('streams')
        .where({ id: streamId, user_id: req.user.id })
        .first();

      if (!stream) {
        return res.status(404).json({
          success: false,
          error: 'Stream not found'
        });
      }

      // Update stream
      const [updatedStream] = await db('streams')
        .where({ id: streamId })
        .update({
          ...value,
          updated_at: new Date()
        })
        .returning('*');

      res.json({
        success: true,
        data: updatedStream,
        message: 'Stream updated successfully'
      });

    } catch (dbError) {
      logger.warn('Database not available for stream update');
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable'
      });
    }

  } catch (error) {
    logger.error('Update stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update stream'
    });
  }
});

// @route   POST /api/streams/:id/start
// @desc    Start stream
// @access  Private
router.post('/:id/start', auth, async (req, res) => {
  try {
    const streamId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const stream = await db('streams')
        .where({ id: streamId, user_id: req.user.id })
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

      // Update stream status
      await db('streams')
        .where({ id: streamId })
        .update({
          status: 'active',
          started_at: new Date(),
          updated_at: new Date()
        });

      // In production, this would interface with OvenMediaEngine to actually start the stream
      logger.info(`Stream ${streamId} started by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Stream started successfully'
      });

    } catch (dbError) {
      logger.warn('Database not available for stream start');
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable'
      });
    }

  } catch (error) {
    logger.error('Start stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start stream'
    });
  }
});

// @route   POST /api/streams/:id/stop
// @desc    Stop stream
// @access  Private
router.post('/:id/stop', auth, async (req, res) => {
  try {
    const streamId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const stream = await db('streams')
        .where({ id: streamId, user_id: req.user.id })
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

      // Calculate duration
      const duration = stream.started_at ? 
        Math.floor((new Date() - new Date(stream.started_at)) / 1000) : 0;

      // Update stream status
      await db('streams')
        .where({ id: streamId })
        .update({
          status: 'inactive',
          stopped_at: new Date(),
          duration,
          updated_at: new Date()
        });

      // In production, this would interface with OvenMediaEngine to actually stop the stream
      logger.info(`Stream ${streamId} stopped by user ${req.user.id}`);

      res.json({
        success: true,
        message: 'Stream stopped successfully'
      });

    } catch (dbError) {
      logger.warn('Database not available for stream stop');
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable'
      });
    }

  } catch (error) {
    logger.error('Stop stream error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop stream'
    });
  }
});

module.exports = router;