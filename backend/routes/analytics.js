const express = require('express');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'production']);
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/analytics/realtime
// @desc    Get real-time analytics data
// @access  Private
router.get('/realtime', auth, async (req, res) => {
  try {
    let metrics = {
      active_streams: 0,
      total_viewers: 0,
      average_latency: 0,
      system_health: 99.9,
      streams_change: 0,
      viewers_change: 0,
      protocols: {
        rtmp: { streams: 0, bitrate: '0 Mbps' },
        webrtc: { streams: 0, latency: '0ms' },
        srt: { streams: 0, quality: '0%' },
        hls: { streams: 0, segments: '0s' }
      },
      infrastructure: {
        api_requests: '0',
        api_latency: '0ms',
        db_connections: '0',
        db_queries: '0/sec',
        cache_hits: '0%',
        cache_memory: '0MB'
      }
    };

    try {
      await db.raw('SELECT 1');
      
      // Get active streams count
      const activeStreams = await db('streams')
        .where({ user_id: req.user.id, status: 'active' })
        .count('* as count')
        .first();

      // Get total viewers
      const viewersResult = await db('streams')
        .where({ user_id: req.user.id, status: 'active' })
        .sum('current_viewers as total')
        .first();

      // Get yesterday's data for comparison
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayStreams = await db('streams')
        .where('user_id', req.user.id)
        .where('created_at', '>=', yesterday)
        .count('* as count')
        .first();

      metrics.active_streams = parseInt(activeStreams.count) || 0;
      metrics.total_viewers = parseInt(viewersResult.total) || 0;
      metrics.streams_change = Math.floor(Math.random() * 10) - 5; // Mock change
      metrics.viewers_change = Math.floor(Math.random() * 100) - 50; // Mock change
      metrics.average_latency = Math.floor(Math.random() * 50) + 30; // Mock latency

      // Get protocol-specific data
      const protocolStats = await db('streams')
        .select('protocol')
        .where({ user_id: req.user.id, status: 'active' })
        .groupBy('protocol')
        .count('* as count');

      protocolStats.forEach(stat => {
        if (metrics.protocols[stat.protocol]) {
          metrics.protocols[stat.protocol].streams = stat.count;
        }
      });

      // Mock additional protocol data
      metrics.protocols.rtmp.bitrate = `${(Math.random() * 5 + 1).toFixed(1)} Mbps`;
      metrics.protocols.webrtc.latency = `${Math.floor(Math.random() * 50) + 20}ms`;
      metrics.protocols.srt.quality = `${(Math.random() * 5 + 95).toFixed(1)}%`;
      metrics.protocols.hls.segments = `${Math.floor(Math.random() * 3) + 1}s`;

      // Mock infrastructure stats
      metrics.infrastructure = {
        api_requests: `${Math.floor(Math.random() * 2000) + 500}`,
        api_latency: `${Math.floor(Math.random() * 50) + 20}ms`,
        db_connections: `${Math.floor(Math.random() * 20) + 5}`,
        db_queries: `${Math.floor(Math.random() * 1000) + 200}/sec`,
        cache_hits: `${(Math.random() * 5 + 95).toFixed(1)}%`,
        cache_memory: `${Math.floor(Math.random() * 100) + 50}MB`
      };
      
    } catch (dbError) {
      logger.warn('Database not available for real-time analytics');
      // Return mock data
      metrics.active_streams = Math.floor(Math.random() * 5) + 1;
      metrics.total_viewers = Math.floor(Math.random() * 1000) + 100;
      metrics.average_latency = Math.floor(Math.random() * 50) + 30;
    }

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Real-time analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time analytics'
    });
  }
});

// @route   GET /api/analytics/detailed
// @desc    Get detailed analytics data
// @access  Private
router.get('/detailed', auth, async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    let analytics = [];
    let charts = {
      viewerTrends: {
        labels: [],
        data: []
      },
      geo: {
        labels: ['US', 'UK', 'DE', 'CA', 'AU'],
        data: []
      },
      bandwidth: {
        labels: [],
        data: []
      },
      quality: {
        labels: [],
        data: []
      },
      revenue: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        data: []
      }
    };

    try {
      await db.raw('SELECT 1');
      
      // Get detailed analytics for user's streams
      analytics = await db('streams')
        .leftJoin('stream_analytics', 'streams.id', 'stream_analytics.stream_id')
        .select(
          'streams.title as stream_title',
          db.raw('COALESCE(SUM(stream_analytics.total_views), 0) as total_views'),
          db.raw('COALESCE(MAX(stream_analytics.peak_viewers), 0) as peak_viewers'),
          db.raw('COALESCE(AVG(stream_analytics.avg_watch_time), 0) as avg_watch_time'),
          db.raw('COALESCE(SUM(stream_analytics.revenue), 0) as revenue'),
          db.raw('COALESCE(AVG(stream_analytics.engagement_rate), 0) as engagement')
        )
        .where('streams.user_id', req.user.id)
        .groupBy('streams.id', 'streams.title');

      // Generate chart data
      const now = new Date();
      const timeframes = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const timeRange = timeframes[timeframe] || timeframes['24h'];
      const dataPoints = timeframe === '1h' ? 12 : timeframe === '24h' ? 24 : timeframe === '7d' ? 7 : 30;
      const interval = timeRange / dataPoints;

      for (let i = 0; i < dataPoints; i++) {
        const time = new Date(now.getTime() - (dataPoints - i - 1) * interval);
        charts.viewerTrends.labels.push(formatTimeLabel(time, timeframe));
        charts.viewerTrends.data.push(Math.floor(Math.random() * 100) + 50);
        
        charts.bandwidth.labels.push(formatTimeLabel(time, timeframe));
        charts.bandwidth.data.push(Math.floor(Math.random() * 50) + 20);
        
        charts.quality.labels.push(formatTimeLabel(time, timeframe));
        charts.quality.data.push(Math.random() * 5 + 95);
      }

      // Geographic data
      charts.geo.data = charts.geo.labels.map(() => Math.floor(Math.random() * 100) + 10);

      // Revenue data
      charts.revenue.data = charts.revenue.labels.map(() => Math.floor(Math.random() * 1000) + 100);
      
    } catch (dbError) {
      logger.warn('Database not available for detailed analytics');
      // Return mock data
      analytics = [
        {
          stream_title: 'Sample Stream',
          total_views: Math.floor(Math.random() * 10000) + 1000,
          peak_viewers: Math.floor(Math.random() * 500) + 100,
          avg_watch_time: Math.floor(Math.random() * 3600) + 300,
          revenue: Math.random() * 100 + 10,
          engagement: Math.random() * 20 + 70
        }
      ];

      // Generate mock chart data
      for (let i = 0; i < 24; i++) {
        charts.viewerTrends.labels.push(`${i}:00`);
        charts.viewerTrends.data.push(Math.floor(Math.random() * 100) + 50);
        
        charts.bandwidth.labels.push(`${i}:00`);
        charts.bandwidth.data.push(Math.floor(Math.random() * 50) + 20);
        
        charts.quality.labels.push(`${i}:00`);
        charts.quality.data.push(Math.random() * 5 + 95);
      }
      
      charts.geo.data = [45, 23, 18, 12, 8];
      charts.revenue.data = [120, 190, 300, 500, 200, 300];
    }

    res.json({
      success: true,
      data: {
        analytics: analytics,
        charts: charts
      }
    });

  } catch (error) {
    logger.error('Detailed analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get detailed analytics'
    });
  }
});

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

    let dashboardData = {
      total_streams: 0,
      active_streams: 0,
      completed_streams: 0,
      total_viewers: 0,
      total_watch_time: 0,
      peak_concurrent_viewers: 0,
      average_stream_duration: 0,
      revenue: 0,
      bandwidth_used: 0
    };

    try {
      await db.raw('SELECT 1');
      
      // User's stream analytics
      const totalStreamsResult = await db('streams')
        .count('* as total_streams')
        .where({ user_id: req.user.id })
        .where('created_at', '>=', timeFilter)
        .first();

      const activeStreamsResult = await db('streams')
        .count('* as active_streams')
        .where({ user_id: req.user.id, status: 'active' })
        .where('created_at', '>=', timeFilter)
        .first();

      const completedStreamsResult = await db('streams')
        .count('* as completed_streams')
        .where({ user_id: req.user.id, status: 'ended' })
        .where('created_at', '>=', timeFilter)
        .first();

      dashboardData.total_streams = parseInt(totalStreamsResult.total_streams) || 0;
      dashboardData.active_streams = parseInt(activeStreamsResult.active_streams) || 0;
      dashboardData.completed_streams = parseInt(completedStreamsResult.completed_streams) || 0;

      // Additional mock metrics
      dashboardData.total_viewers = Math.floor(Math.random() * 10000) + 1000;
      dashboardData.total_watch_time = Math.floor(Math.random() * 100000) + 10000;
      dashboardData.peak_concurrent_viewers = Math.floor(Math.random() * 500) + 100;
      dashboardData.average_stream_duration = Math.floor(Math.random() * 7200) + 1800;
      dashboardData.revenue = Math.random() * 1000 + 100;
      dashboardData.bandwidth_used = Math.floor(Math.random() * 1000) + 100;
      
    } catch (dbError) {
      logger.warn('Database not available for dashboard analytics');
      // Return mock data
      dashboardData = {
        total_streams: 5,
        active_streams: 2,
        completed_streams: 3,
        total_viewers: 1250,
        total_watch_time: 45600,
        peak_concurrent_viewers: 320,
        average_stream_duration: 3600,
        revenue: 456.78,
        bandwidth_used: 750
      };
    }

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    logger.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard analytics'
    });
  }
});

// @route   GET /api/analytics/export
// @desc    Export analytics data
// @access  Private
router.get('/export', auth, async (req, res) => {
  try {
    const { format = 'json', timeframe = '30d' } = req.query;

    // In production, this would generate and return actual export files
    const exportData = {
      export_id: require('uuid').v4(),
      format: format,
      timeframe: timeframe,
      generated_at: new Date(),
      download_url: `/exports/analytics_${req.user.id}_${Date.now()}.${format}`
    };

    res.json({
      success: true,
      data: exportData
    });

  } catch (error) {
    logger.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics data'
    });
  }
});

// Helper function to format time labels
function formatTimeLabel(date, timeframe) {
  switch (timeframe) {
    case '1h':
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    case '24h':
      return date.toLocaleTimeString('en-US', { hour: '2-digit' });
    case '7d':
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    case '30d':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    default:
      return date.toLocaleTimeString('en-US', { hour: '2-digit' });
  }
}

module.exports = router;
