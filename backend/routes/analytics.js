const express = require('express');
const db = require('../config/database-fallback');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get analytics dashboard data
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    let timeFilter;
    switch (timeframe) {
    case '1h':
      timeFilter = new Date(Date.now() - 60 * 60 * 1000);
      break;
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
      timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // User's stream analytics - SQLite compatible with separate queries
    const totalStreamsResult = await db('streams')
      .count('* as total_streams')
      .where({ user_id: req.user.id })
      .where('created_at', '>=', timeFilter)
      .first();

    const activeStreamsResult = await db('streams')
      .count('* as active_streams')
      .where({ user_id: req.user.id, status: 'live' })
      .where('created_at', '>=', timeFilter)
      .first();

    const completedStreamsResult = await db('streams')
      .count('* as completed_streams')
      .where({ user_id: req.user.id, status: 'ended' })
      .where('created_at', '>=', timeFilter)
      .first();

    const userStreams = {
      total_streams: totalStreamsResult?.total_streams || 0,
      active_streams: activeStreamsResult?.active_streams || 0,
      completed_streams: completedStreamsResult?.completed_streams || 0
    };

    // Stream performance for user's streams - Fixed column names
    const streamPerformance = await db('stream_analytics')
      .join('streams', 'stream_analytics.stream_id', 'streams.id')
      .where('streams.user_id', req.user.id)
      .where('stream_analytics.created_at', '>=', timeFilter)
      .avg('stream_analytics.unique_viewers as avg_viewers')
      .max('stream_analytics.peak_concurrent_viewers as max_viewers')
      .sum('stream_analytics.total_views as total_viewers')
      .avg('stream_analytics.avg_watch_duration as avg_duration')
      .sum('stream_analytics.total_watch_time as total_watch_time')
      .first();

    // Recent streams
    const recentStreams = await db('streams')
      .select('id', 'title', 'status', 'protocol', 'started_at', 'ended_at', 'created_at')
      .where({ user_id: req.user.id })
      .orderBy('created_at', 'desc')
      .limit(5);

    // Stream analytics by protocol
    const protocolStats = await db('streams')
      .select('protocol')
      .count('* as count')
      .where({ user_id: req.user.id })
      .where('created_at', '>=', timeFilter)
      .groupBy('protocol');

    // Daily analytics trend - SQLite compatible with correct column names
    const dailyTrend = await db('stream_analytics')
      .join('streams', 'stream_analytics.stream_id', 'streams.id')
      .select(db.raw('date(stream_analytics.date) as date'))
      .avg('stream_analytics.unique_viewers as avg_viewers')
      .sum('stream_analytics.total_views as total_viewers')
      .avg('stream_analytics.avg_watch_duration as avg_duration')
      .where('streams.user_id', req.user.id)
      .where('stream_analytics.created_at', '>=', timeFilter)
      .groupBy(db.raw('date(stream_analytics.date)'))
      .orderBy('date', 'asc');

    // Quality metrics - simplified to use available columns
    const qualityMetrics = await db('stream_analytics')
      .join('streams', 'stream_analytics.stream_id', 'streams.id')
      .where('streams.user_id', req.user.id)
      .where('stream_analytics.created_at', '>=', timeFilter)
      .count('* as total_analytics')
      .first();

    const dashboardData = {
      overview: {
        total_streams: userStreams?.total_streams || 0,
        active_streams: userStreams?.active_streams || 0,
        completed_streams: userStreams?.completed_streams || 0,
        avg_viewers: Number((streamPerformance?.avg_viewers || 0).toFixed(0)),
        max_viewers: streamPerformance?.max_viewers || 0,
        total_viewers: streamPerformance?.total_viewers || 0,
        total_watch_time: Number((streamPerformance?.total_watch_time || 0).toFixed(0)),
        avg_duration: Number((streamPerformance?.avg_duration || 0).toFixed(0))
      },
      performance: {
        avg_bitrate: 0, // Not available in current schema
        total_dropped_frames: 0, // Not available in current schema
        avg_cpu_usage: 0, // Not available in current schema
        avg_memory_usage: 0, // Not available in current schema
        streams_with_drops: 0, // Not available in current schema
        quality_score: 100 // Default good quality score
      },
      recent_streams: recentStreams,
      protocol_distribution: protocolStats,
      daily_trend: dailyTrend.map(d => ({
        date: d.date,
        avg_viewers: Number((d.avg_viewers || 0).toFixed(0)),
        total_viewers: d.total_viewers || 0,
        avg_duration: Number((d.avg_duration || 0).toFixed(0))
      }))
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Analytics dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/analytics/streams/:id
// @desc    Get detailed analytics for a specific stream
// @access  Private
router.get('/streams/:id', auth, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    // Verify stream ownership
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

    let timeFilter;
    switch (timeframe) {
    case '1h':
      timeFilter = new Date(Date.now() - 60 * 60 * 1000);
      break;
    case '24h':
      timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // Get detailed stream analytics
    const analytics = await db('stream_analytics')
      .where({ stream_id: req.params.id })
      .where('recorded_at', '>=', timeFilter)
      .orderBy('recorded_at', 'asc');

    // Get summary statistics
    const summary = await db('stream_analytics')
      .where({ stream_id: req.params.id })
      .where('recorded_at', '>=', timeFilter)
      .max('peak_viewers as max_viewers')
      .avg('current_viewers as avg_viewers')
      .sum('total_viewers as total_viewers')
      .avg('duration_seconds as avg_duration')
      .sum('data_transferred_mb as total_data_mb')
      .avg('average_bitrate as avg_bitrate')
      .sum('dropped_frames as total_dropped_frames')
      .avg('cpu_usage as avg_cpu')
      .avg('memory_usage as avg_memory');

    res.json({
      success: true,
      data: {
        stream: {
          id: stream.id,
          title: stream.title,
          status: stream.status,
          protocol: stream.protocol,
          started_at: stream.started_at,
          ended_at: stream.ended_at
        },
        summary: {
          max_viewers: summary[0]?.max_viewers || 0,
          avg_viewers: Number((summary[0]?.avg_viewers || 0).toFixed(0)),
          total_viewers: summary[0]?.total_viewers || 0,
          avg_duration: Number((summary[0]?.avg_duration || 0).toFixed(0)),
          total_data_mb: Number((summary[0]?.total_data_mb || 0).toFixed(2)),
          avg_bitrate: Number((summary[0]?.avg_bitrate || 0).toFixed(0)),
          total_dropped_frames: summary[0]?.total_dropped_frames || 0,
          avg_cpu_usage: Number((summary[0]?.avg_cpu || 0).toFixed(1)),
          avg_memory_usage: Number((summary[0]?.avg_memory || 0).toFixed(1))
        },
        timeseries: analytics.map(a => ({
          timestamp: a.recorded_at,
          current_viewers: a.current_viewers,
          cpu_usage: a.cpu_usage,
          memory_usage: a.memory_usage,
          bitrate: a.average_bitrate,
          dropped_frames: a.dropped_frames
        }))
      }
    });
  } catch (error) {
    logger.error('Stream analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/analytics/system (Admin only)
// @desc    Get system-wide analytics
// @access  Private (Admin)
router.get('/system', auth, authorize('admin'), async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    let timeFilter;
    switch (timeframe) {
    case '1h':
      timeFilter = new Date(Date.now() - 60 * 60 * 1000);
      break;
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
      timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    // System overview
    const systemOverview = await db('streams')
      .count('* as total_streams')
      .count('case when status = "live" then 1 end as active_streams')
      .avg('case when status = "live" then max_viewers end as avg_max_viewers')
      .where('created_at', '>=', timeFilter);

    // User activity
    const userActivity = await db('users')
      .count('* as total_users')
      .count('case when is_active = 1 then 1 end as active_users')
      .count('case when last_login >= ? then 1 end as recent_users', [timeFilter]);

    // System health
    const systemHealth = await db('system_health')
      .where('recorded_at', '>=', timeFilter)
      .avg('cpu_usage as avg_cpu')
      .avg('memory_usage as avg_memory')
      .avg('disk_usage as avg_disk')
      .avg('active_connections as avg_connections')
      .avg('network_in_mbps as avg_network_in')
      .avg('network_out_mbps as avg_network_out');

    // Top streams by viewers
    const topStreams = await db('stream_analytics')
      .join('streams', 'stream_analytics.stream_id', 'streams.id')
      .join('users', 'streams.user_id', 'users.id')
      .select('streams.title', 'users.name as user_name', 'stream_analytics.peak_viewers')
      .where('stream_analytics.recorded_at', '>=', timeFilter)
      .orderBy('stream_analytics.peak_viewers', 'desc')
      .limit(10);

    // Protocol usage
    const protocolUsage = await db('streams')
      .select('protocol')
      .count('* as count')
      .where('created_at', '>=', timeFilter)
      .groupBy('protocol');

    const systemData = {
      overview: {
        total_streams: systemOverview[0]?.total_streams || 0,
        active_streams: systemOverview[0]?.active_streams || 0,
        avg_max_viewers: Number((systemOverview[0]?.avg_max_viewers || 0).toFixed(0)),
        total_users: userActivity[0]?.total_users || 0,
        active_users: userActivity[0]?.active_users || 0,
        recent_users: userActivity[0]?.recent_users || 0
      },
      system_health: {
        avg_cpu_usage: Number((systemHealth[0]?.avg_cpu || 0).toFixed(1)),
        avg_memory_usage: Number((systemHealth[0]?.avg_memory || 0).toFixed(1)),
        avg_disk_usage: Number((systemHealth[0]?.avg_disk || 0).toFixed(1)),
        avg_connections: Number((systemHealth[0]?.avg_connections || 0).toFixed(0)),
        avg_network_in: Number((systemHealth[0]?.avg_network_in || 0).toFixed(2)),
        avg_network_out: Number((systemHealth[0]?.avg_network_out || 0).toFixed(2))
      },
      top_streams: topStreams,
      protocol_usage: protocolUsage
    };

    res.json({
      success: true,
      data: systemData
    });
  } catch (error) {
    logger.error('System analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/analytics/realtime
// @desc    Get real-time analytics data for public display
// @access  Public
router.get('/realtime', async (req, res) => {
  try {
    let totalViewers = 0;
    let averageLatency = 85; // Default production target
    let activeStreams = 0;
    let status = 'operational';

    // Try to get real data from database if available
    try {
      // Check if database is available by testing connection
      await db.raw('SELECT 1');
      
      // Get current system statistics from real data
      const activeStreamResult = await db('streams')
        .where('status', 'live')
        .count('* as count')
        .first();

      const totalViewerResult = await db('streams')
        .where('status', 'live')
        .sum('current_viewers as total')
        .first();

      // Get recent latency measurements (last 5 minutes)
      const recentLatency = await db('six_sigma_metrics')
        .where('metric_type', 'latency')
        .where('measured_at', '>=', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .avg('value as average_latency')
        .first();

      activeStreams = activeStreamResult?.count || 0;
      totalViewers = totalViewerResult?.total || 0;
      averageLatency = recentLatency?.average_latency || 85;
      status = 'operational';
      
      logger.info(`Real-time analytics: ${totalViewers} viewers, ${activeStreams} streams, ${averageLatency}ms latency`);
      
    } catch (dbError) {
      // Database not available - use minimal fallback data
      logger.warn('Database unavailable for real-time analytics, using fallback data');
      logger.error('Database error details:', dbError.message);
      totalViewers = 0;
      averageLatency = 85; 
      activeStreams = 0;
      status = 'limited'; // Indicate limited functionality
    }

    res.json({
      success: true,
      data: {
        total_viewers: totalViewers,
        average_latency: Number(averageLatency.toFixed(0)),
        active_streams: activeStreams,
        total_bandwidth: Number((activeStreams * 0.5).toFixed(1)), // Estimate bandwidth based on streams
        status: status,
        last_updated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Real-time analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
      data: {
        total_viewers: 0,
        average_latency: 85,
        active_streams: 0,
        total_bandwidth: 0,
        status: 'degraded',
        last_updated: new Date().toISOString()
      }
    });
  }
});

// @route   GET /api/analytics/dashboard-public
// @desc    Get public dashboard metrics (no authentication required)
// @access  Public
router.get('/dashboard-public', async (req, res) => {
  try {
    let systemData = {
      total_streams: 0,
      active_streams: 0,
      total_users: 0,
      uptime: '--'
    };

    // Try to get real data from database if available
    try {
      await db.raw('SELECT 1');
      
      // Get basic stream statistics
      const streamStats = await db('streams')
        .count('* as total_streams')
        .first();

      const activeStreams = await db('streams')
        .where('status', 'live')
        .count('* as active_streams')
        .first();

      // Get user count
      const userStats = await db('users')
        .count('* as total_users')
        .first();

      logger.info('Dashboard query results:', { streamStats, activeStreams, userStats });

      systemData = {
        total_streams: parseInt(streamStats?.total_streams || 0),
        active_streams: parseInt(activeStreams?.active_streams || 0),
        total_users: parseInt(userStats?.total_users || 0),
        uptime: process.uptime ? Math.floor(process.uptime() / 60) + ' minutes' : '--'
      };
      
    } catch (dbError) {
      logger.warn('Database unavailable for public dashboard metrics');
      // Keep default values
    }

    res.json({
      success: true,
      data: systemData
    });
  } catch (error) {
    logger.error('Public dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard metrics'
    });
  }
});

module.exports = router;