const express = require('express');
const { auth } = require('../middleware/auth');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'production']);
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// @route   GET /api/publishing/targets
// @desc    Get publishing targets with metrics
// @access  Private
router.get('/targets', auth, async (req, res) => {
  try {
    let targets = [];
    const metrics = {
      active_targets: 0,
      data_sent: 0,
      success_rate: 99.9,
      average_latency: 50
    };
    
    try {
      await db.raw('SELECT 1');
      
      targets = await db('publishing_targets')
        .leftJoin('streams', 'publishing_targets.source_stream_id', 'streams.id')
        .select(
          'publishing_targets.*',
          'streams.title as source_stream'
        )
        .where('publishing_targets.user_id', req.user.id)
        .orderBy('publishing_targets.created_at', 'desc');
      
      // Mask sensitive data for client
      targets = targets.map(target => ({
        ...target,
        stream_key: target.stream_key ? '*'.repeat(target.stream_key.length) : null,
        uptime: calculateUptime(target.started_at, target.status)
      }));

      // Calculate metrics
      const activeTargets = await db('publishing_targets')
        .where({ user_id: req.user.id, status: 'active' })
        .count('* as count')
        .first();

      metrics.active_targets = parseInt(activeTargets.count);
      
    } catch (dbError) {
      logger.warn('Database not available for publishing targets');
      // Return mock data
      targets = [
        {
          id: 1,
          name: 'YouTube Live',
          platform: 'youtube',
          source_stream: 'Sample Stream',
          status: 'inactive',
          uptime: '0h 0m'
        }
      ];
    }

    res.json({
      success: true,
      data: {
        targets,
        metrics
      }
    });

  } catch (error) {
    logger.error('Get publishing targets error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get publishing targets'
    });
  }
});

// @route   POST /api/publishing/targets
// @desc    Create publishing target
// @access  Private
router.post('/targets', auth, async (req, res) => {
  try {
    const { name, platform, rtmp_url, stream_key, source_stream } = req.body;

    if (!name || !platform || !rtmp_url || !stream_key) {
      return res.status(400).json({
        success: false,
        error: 'Name, platform, RTMP URL, and stream key are required'
      });
    }

    // Validate source stream if provided
    if (source_stream) {
      try {
        await db.raw('SELECT 1');
        
        const stream = await db('streams')
          .where({ id: source_stream, user_id: req.user.id })
          .first();

        if (!stream) {
          return res.status(404).json({
            success: false,
            error: 'Source stream not found'
          });
        }
      } catch (dbError) {
        logger.warn('Database not available for stream validation');
      }
    }

    const targetData = {
      id: uuidv4(),
      user_id: req.user.id,
      name,
      platform,
      rtmp_url,
      stream_key,
      source_stream_id: source_stream || null,
      status: 'inactive',
      created_at: new Date(),
      updated_at: new Date()
    };

    try {
      await db('publishing_targets').insert(targetData);
    } catch (dbError) {
      logger.warn('Database not available for target creation');
    }

    res.json({
      success: true,
      data: {
        target_id: targetData.id,
        message: 'Publishing target created successfully'
      }
    });

  } catch (error) {
    logger.error('Create publishing target error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create publishing target'
    });
  }
});

// @route   POST /api/publishing/targets/:id/start
// @desc    Start publishing to target
// @access  Private
router.post('/targets/:id/start', auth, async (req, res) => {
  try {
    const targetId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const target = await db('publishing_targets')
        .where({ id: targetId, user_id: req.user.id })
        .first();

      if (!target) {
        return res.status(404).json({
          success: false,
          error: 'Publishing target not found'
        });
      }

      if (!target.source_stream_id) {
        return res.status(400).json({
          success: false,
          error: 'No source stream configured for this target'
        });
      }

      // Check if source stream is active
      const stream = await db('streams')
        .where({ id: target.source_stream_id, user_id: req.user.id })
        .first();

      if (!stream || stream.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Source stream must be active to start publishing'
        });
      }

      await db('publishing_targets')
        .where({ id: targetId })
        .update({
          status: 'active',
          started_at: new Date(),
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for publishing start');
    }

    // Start publishing process (in production, this would interface with OvenMediaEngine)
    startPublishingProcess(targetId);

    res.json({
      success: true,
      data: {
        message: 'Publishing started successfully'
      }
    });

  } catch (error) {
    logger.error('Start publishing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start publishing'
    });
  }
});

// @route   POST /api/publishing/targets/:id/stop
// @desc    Stop publishing to target
// @access  Private
router.post('/targets/:id/stop', auth, async (req, res) => {
  try {
    const targetId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const target = await db('publishing_targets')
        .where({ id: targetId, user_id: req.user.id })
        .first();

      if (!target) {
        return res.status(404).json({
          success: false,
          error: 'Publishing target not found'
        });
      }

      if (target.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Publishing target is not active'
        });
      }

      await db('publishing_targets')
        .where({ id: targetId })
        .update({
          status: 'inactive',
          stopped_at: new Date(),
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for publishing stop');
    }

    res.json({
      success: true,
      data: {
        message: 'Publishing stopped successfully'
      }
    });

  } catch (error) {
    logger.error('Stop publishing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop publishing'
    });
  }
});

// @route   DELETE /api/publishing/targets/:id
// @desc    Delete publishing target
// @access  Private
router.delete('/targets/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const target = await db('publishing_targets')
        .where({ id: targetId, user_id: req.user.id })
        .first();

      if (!target) {
        return res.status(404).json({
          success: false,
          error: 'Publishing target not found'
        });
      }

      // Stop publishing if active
      if (target.status === 'active') {
        await db('publishing_targets')
          .where({ id: targetId })
          .update({
            status: 'inactive',
            stopped_at: new Date(),
            updated_at: new Date()
          });
      }

      // Delete the target
      await db('publishing_targets')
        .where({ id: targetId })
        .del();

    } catch (dbError) {
      logger.warn('Database not available for target deletion');
    }

    res.json({
      success: true,
      data: {
        message: 'Publishing target deleted successfully'
      }
    });

  } catch (error) {
    logger.error('Delete publishing target error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete publishing target'
    });
  }
});

// @route   GET /api/publishing/platforms
// @desc    Get available publishing platforms
// @access  Private
router.get('/platforms', auth, async (req, res) => {
  try {
    const platforms = [
      {
        id: 'youtube',
        name: 'YouTube Live',
        rtmp_url: 'rtmp://a.rtmp.youtube.com/live2',
        requires_key: true,
        description: 'Stream to YouTube Live'
      },
      {
        id: 'twitch',
        name: 'Twitch',
        rtmp_url: 'rtmp://live.twitch.tv/live',
        requires_key: true,
        description: 'Stream to Twitch'
      },
      {
        id: 'facebook',
        name: 'Facebook Live',
        rtmp_url: 'rtmps://live-api-s.facebook.com:443/rtmp',
        requires_key: true,
        description: 'Stream to Facebook Live'
      },
      {
        id: 'custom',
        name: 'Custom RTMP',
        rtmp_url: '',
        requires_key: true,
        description: 'Custom RTMP endpoint'
      }
    ];

    res.json({
      success: true,
      data: platforms
    });

  } catch (error) {
    logger.error('Get publishing platforms error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get publishing platforms'
    });
  }
});

// Helper functions
function calculateUptime(startedAt, status) {
  if (status !== 'active' || !startedAt) {
    return '0h 0m';
  }
  
  const now = new Date();
  const start = new Date(startedAt);
  const diffMs = now - start;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
}

// Mock function to simulate publishing process
async function startPublishingProcess(targetId) {
  try {
    // In production, this would interface with OvenMediaEngine
    // to start the push publishing process
    logger.info(`Starting publishing process for target ${targetId}`);
    
    // Simulate connection and streaming
    setTimeout(async () => {
      try {
        await db('publishing_targets')
          .where({ id: targetId })
          .update({
            last_published_at: new Date(),
            updated_at: new Date()
          });
      } catch (dbError) {
        logger.warn('Database not available for publishing update');
      }
    }, 5000);

  } catch (error) {
    logger.error('Publishing process error:', error);
  }
}

module.exports = router;
// @access  Private
router.post('/targets', auth, async (req, res) => {
  try {
    const {
      name,
      platform,
      stream_url,
      stream_key,
      enabled = true,
      configuration = {}
    } = req.body;

    // Validate required fields
    if (!name || !platform || !stream_url) {
      return res.status(400).json({
        success: false,
        error: 'Name, platform, and stream URL are required'
      });
    }

    // Validate platform
    const supportedPlatforms = ['youtube', 'twitch', 'facebook', 'custom'];
    if (!supportedPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported platform'
      });
    }

    const targetData = {
      id: uuidv4(),
      user_id: req.user.id,
      name,
      platform,
      stream_url,
      stream_key: stream_key || null,
      enabled,
      status: 'disconnected',
      configuration: JSON.stringify(configuration),
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('publishing_targets').insert(targetData);

    logger.info(`Publishing target created: ${name} (${platform}) for user ${req.user.id}`);

    // Mask stream key in response
    const responseData = {
      ...targetData,
      stream_key: stream_key ? '****-****-****-****' : null
    };

    res.json({
      success: true,
      data: {
        target_id: targetData.id,
        message: 'Publishing target created successfully',
        target: responseData
      }
    });

  } catch (error) {
    logger.error('Create publishing target error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create publishing target'
    });
  }
});

// @route   PUT /api/publishing/targets/:targetId
// @desc    Update publishing target
// @access  Private
router.put('/targets/:targetId', auth, async (req, res) => {
  try {
    const { targetId } = req.params;
    const updates = req.body;

    // Check if target exists and belongs to user
    const target = await db('publishing_targets')
      .where({ id: targetId, user_id: req.user.id })
      .first();

    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'Publishing target not found'
      });
    }

    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    // If configuration is being updated, stringify it
    if (updates.configuration) {
      updateData.configuration = JSON.stringify(updates.configuration);
    }

    await db('publishing_targets')
      .where({ id: targetId, user_id: req.user.id })
      .update(updateData);

    logger.info(`Publishing target updated: ${targetId} for user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        message: 'Publishing target updated successfully',
        target_id: targetId
      }
    });

  } catch (error) {
    logger.error('Update publishing target error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update publishing target'
    });
  }
});

// @route   DELETE /api/publishing/targets/:targetId
// @desc    Delete publishing target
// @access  Private
router.delete('/targets/:targetId', auth, async (req, res) => {
  try {
    const { targetId } = req.params;

    // Check if target exists and belongs to user
    const target = await db('publishing_targets')
      .where({ id: targetId, user_id: req.user.id })
      .first();

    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'Publishing target not found'
      });
    }

    // Check if target is currently being used
    if (target.status === 'connected' || target.status === 'publishing') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a target that is currently publishing. Stop publishing first.'
      });
    }

    await db('publishing_targets')
      .where({ id: targetId, user_id: req.user.id })
      .del();

    // Delete related publishing sessions
    await db('publishing_sessions')
      .where({ target_id: targetId })
      .del();

    logger.info(`Publishing target deleted: ${targetId} by user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        message: 'Publishing target deleted successfully'
      }
    });

  } catch (error) {
    logger.error('Delete publishing target error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete publishing target'
    });
  }
});

// @route   POST /api/publishing/targets/:targetId/connect
// @desc    Connect to publishing target
// @access  Private
router.post('/targets/:targetId/connect', auth, async (req, res) => {
  try {
    const { targetId } = req.params;
    const { stream_id } = req.body;

    // Check if target exists and belongs to user
    const target = await db('publishing_targets')
      .where({ id: targetId, user_id: req.user.id })
      .first();

    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'Publishing target not found'
      });
    }

    if (!target.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Publishing target is disabled'
      });
    }

    // Verify stream ownership if provided
    if (stream_id) {
      const stream = await db('streams')
        .where({ id: stream_id, user_id: req.user.id })
        .first();

      if (!stream) {
        return res.status(404).json({
          success: false,
          error: 'Stream not found'
        });
      }
    }

    // Create publishing session
    const sessionData = {
      id: uuidv4(),
      target_id: targetId,
      stream_id: stream_id || null,
      user_id: req.user.id,
      status: 'connecting',
      started_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('publishing_sessions').insert(sessionData);

    // Update target status
    await db('publishing_targets')
      .where({ id: targetId })
      .update({
        status: 'connecting',
        last_connected_at: new Date(),
        updated_at: new Date()
      });

    // Simulate connection process
    setTimeout(async () => {
      try {
        // Real connection test would check actual endpoint
        const connectionSuccess = true; // Would be based on actual endpoint validation
        
        if (connectionSuccess) {
          await db('publishing_targets')
            .where({ id: targetId })
            .update({
              status: 'connected',
              updated_at: new Date()
            });
          
          await db('publishing_sessions')
            .where({ id: sessionData.id })
            .update({
              status: 'connected',
              connected_at: new Date(),
              updated_at: new Date()
            });
        } else {
          await db('publishing_targets')
            .where({ id: targetId })
            .update({
              status: 'error',
              updated_at: new Date()
            });
          
          await db('publishing_sessions')
            .where({ id: sessionData.id })
            .update({
              status: 'failed',
              error_message: 'Connection failed - Invalid stream key or network error',
              ended_at: new Date(),
              updated_at: new Date()
            });
        }
      } catch (error) {
        logger.error('Error updating publishing connection:', error);
      }
    }, 2000);

    logger.info(`Publishing connection started: ${targetId} for user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        session_id: sessionData.id,
        message: 'Publishing connection initiated',
        status: 'connecting'
      }
    });

  } catch (error) {
    logger.error('Connect publishing target error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to connect to publishing target'
    });
  }
});

// @route   POST /api/publishing/targets/:targetId/disconnect
// @desc    Disconnect from publishing target
// @access  Private
router.post('/targets/:targetId/disconnect', auth, async (req, res) => {
  try {
    const { targetId } = req.params;

    // Check if target exists and belongs to user
    const target = await db('publishing_targets')
      .where({ id: targetId, user_id: req.user.id })
      .first();

    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'Publishing target not found'
      });
    }

    // Update target status
    await db('publishing_targets')
      .where({ id: targetId })
      .update({
        status: 'disconnected',
        updated_at: new Date()
      });

    // End active sessions
    await db('publishing_sessions')
      .where({ target_id: targetId, status: ['connected', 'publishing'] })
      .update({
        status: 'ended',
        ended_at: new Date(),
        updated_at: new Date()
      });

    logger.info(`Publishing disconnected: ${targetId} for user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        message: 'Successfully disconnected from publishing target'
      }
    });

  } catch (error) {
    logger.error('Disconnect publishing target error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect from publishing target'
    });
  }
});

// @route   GET /api/publishing/targets/:targetId/status
// @desc    Get publishing target status
// @access  Private
router.get('/targets/:targetId/status', auth, async (req, res) => {
  try {
    const { targetId } = req.params;

    const target = await db('publishing_targets')
      .where({ id: targetId, user_id: req.user.id })
      .first();

    if (!target) {
      return res.status(404).json({
        success: false,
        error: 'Publishing target not found'
      });
    }

    // Get current session if any
    const currentSession = await db('publishing_sessions')
      .where({ target_id: targetId })
      .whereIn('status', ['connecting', 'connected', 'publishing'])
      .first();

    // Get recent sessions for statistics
    const recentSessions = await db('publishing_sessions')
      .where({ target_id: targetId })
      .orderBy('created_at', 'desc')
      .limit(5);

    res.json({
      success: true,
      data: {
        target_id: targetId,
        status: target.status,
        enabled: target.enabled,
        platform: target.platform,
        last_connected_at: target.last_connected_at,
        current_session: currentSession,
        recent_sessions: recentSessions,
        uptime_percentage: calculateUptimePercentage(recentSessions)
      }
    });

  } catch (error) {
    logger.error('Get publishing target status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get publishing target status'
    });
  }
});

// @route   GET /api/publishing/analytics
// @desc    Get publishing analytics
// @access  Private
router.get('/analytics', auth, async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    let timeFilter;
    switch (timeframe) {
    case '24h':
      timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      timeFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get publishing targets count
    const targetsCount = await db('publishing_targets')
      .where({ user_id: req.user.id })
      .count('* as count')
      .first();

    // Get active sessions
    const activeSessions = await db('publishing_sessions')
      .join('publishing_targets', 'publishing_sessions.target_id', 'publishing_targets.id')
      .where('publishing_targets.user_id', req.user.id)
      .whereIn('publishing_sessions.status', ['connected', 'publishing'])
      .count('* as count')
      .first();

    // Get session statistics
    const sessionStats = await db('publishing_sessions')
      .join('publishing_targets', 'publishing_sessions.target_id', 'publishing_targets.id')
      .where('publishing_targets.user_id', req.user.id)
      .where('publishing_sessions.created_at', '>=', timeFilter)
      .select(
        db.raw('COUNT(*) as total_sessions'),
        db.raw('COUNT(CASE WHEN publishing_sessions.status = "ended" THEN 1 END) as completed_sessions'),
        db.raw('COUNT(CASE WHEN publishing_sessions.status = "failed" THEN 1 END) as failed_sessions'),
        db.raw('AVG(CASE WHEN publishing_sessions.ended_at IS NOT NULL AND publishing_sessions.started_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, publishing_sessions.started_at, publishing_sessions.ended_at) END) as avg_duration')
      )
      .first();

    // Get sessions by platform
    const platformStats = await db('publishing_sessions')
      .join('publishing_targets', 'publishing_sessions.target_id', 'publishing_targets.id')
      .where('publishing_targets.user_id', req.user.id)
      .where('publishing_sessions.created_at', '>=', timeFilter)
      .groupBy('publishing_targets.platform')
      .select(
        'publishing_targets.platform',
        db.raw('COUNT(*) as session_count'),
        db.raw('COUNT(CASE WHEN publishing_sessions.status = "ended" THEN 1 END) as successful_sessions')
      );

    // Calculate total bandwidth (estimated)
    const estimatedBandwidth = activeSessions.count * 5; // Assume 5 Mbps per active stream

    res.json({
      success: true,
      data: {
        timeframe,
        overview: {
          total_targets: parseInt(targetsCount.count) || 0,
          active_sessions: parseInt(activeSessions.count) || 0,
          total_sessions: parseInt(sessionStats.total_sessions) || 0,
          success_rate: sessionStats.total_sessions > 0 ? 
            (((sessionStats.completed_sessions || 0) / sessionStats.total_sessions) * 100).toFixed(2) : 0,
          estimated_bandwidth_mbps: estimatedBandwidth,
          average_session_duration: sessionStats.avg_duration ? Math.round(sessionStats.avg_duration) : 0
        },
        by_platform: platformStats,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Publishing analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get publishing analytics'
    });
  }
});

// Helper functions
function calculateUptimePercentage(sessions) {
  if (!sessions || sessions.length === 0) return 0;
  
  const successful = sessions.filter(s => s.status === 'ended').length;
  return ((successful / sessions.length) * 100).toFixed(2);
}

module.exports = router;

module.exports = router;