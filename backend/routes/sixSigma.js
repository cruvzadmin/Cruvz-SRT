const express = require('express');
const db = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Six Sigma calculations
const calculateSigmaLevel = (defects, opportunities) => {
  if (opportunities === 0) return 6.0;
  const dpo = defects / opportunities; // Defects per opportunity
  const dpmo = dpo * 1000000; // Defects per million opportunities
  
  // Simplified sigma level calculation
  if (dpmo <= 3.4) return 6.0;
  if (dpmo <= 233) return 5.0;
  if (dpmo <= 6210) return 4.0;
  if (dpmo <= 66807) return 3.0;
  if (dpmo <= 308537) return 2.0;
  return 1.0;
};

// @route   GET /api/six-sigma/dashboard
// @desc    Get Six Sigma dashboard overview
// @access  Private (Admin only)
router.get('/dashboard', auth, authorize('admin'), async (req, res) => {
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

    // Overall system metrics
    const systemMetrics = await db('six_sigma_metrics')
      .select('category')
      .avg('sigma_level as avg_sigma')
      .count('* as total_measurements')
      .sum('value as total_defects')
      .where('measured_at', '>=', timeFilter)
      .groupBy('category');

    // Current system health
    const latestHealth = await db('system_health')
      .orderBy('recorded_at', 'desc')
      .first();

    // Stream performance
    const streamMetrics = await db('stream_analytics')
      .select()
      .avg('cpu_usage as avg_cpu')
      .avg('memory_usage as avg_memory')
      .sum('dropped_frames as total_dropped_frames')
      .count('* as total_measurements')
      .where('recorded_at', '>=', timeFilter);

    // Active streams
    const activeStreams = await db('streams')
      .count('* as count')
      .where('status', 'live');

    // User activity
    const userActivity = await db('users')
      .count('* as total_users')
      .where('is_active', true);

    const activeUsers = await db('users')
      .count('* as active_users')
      .where('last_login', '>=', timeFilter);

    // API performance from actual request logs
    const apiStats = await db('api_usage_logs')
      .count('* as total_requests')
      .where('created_at', '>=', timeFilter)
      .first();
    
    const apiErrors = await db('api_usage_logs')
      .count('* as error_count')
      .where('created_at', '>=', timeFilter)
      .where('status_code', '>=', 400)
      .first();
    
    const apiRequests = apiStats?.total_requests || 0;
    const errorCount = apiErrors?.error_count || 0;
    const apiSigmaLevel = calculateSigmaLevel(errorCount, apiRequests);

    // Calculate overall Six Sigma score
    const avgSigmaLevel = systemMetrics.reduce((sum, metric) => sum + (metric.avg_sigma || 0), 0) / (systemMetrics.length || 1);

    // Defect tracking
    const defectsByCategory = await db('six_sigma_metrics')
      .select('category')
      .sum('value as total_defects')
      .avg('sigma_level as avg_sigma')
      .where('measured_at', '>=', timeFilter)
      .where('value', '>', 0)
      .groupBy('category')
      .orderBy('total_defects', 'desc');

    // Performance trends
    const performanceTrends = await db('six_sigma_metrics')
      .select()
      .select(db.raw('DATE(measured_at) as date'))
      .avg('sigma_level as avg_sigma')
      .count('* as measurements')
      .where('measured_at', '>=', timeFilter)
      .groupBy(db.raw('DATE(measured_at)'))
      .orderBy('date', 'asc');

    const dashboardData = {
      overview: {
        overall_sigma_level: Number(avgSigmaLevel.toFixed(2)),
        api_sigma_level: Number(apiSigmaLevel.toFixed(2)),
        target_sigma_level: 6.0,
        uptime_percentage: latestHealth ? Number((100 - (latestHealth.cpu_usage * 0.1)).toFixed(2)) : 99.9,
        total_defects: defectsByCategory.reduce((sum, cat) => sum + cat.total_defects, 0),
        defect_rate: Number(((defectsByCategory.reduce((sum, cat) => sum + cat.total_defects, 0) / (apiRequests || 1)) * 100).toFixed(4))
      },
      system_health: {
        cpu_usage: latestHealth?.cpu_usage || 0,
        memory_usage: latestHealth?.memory_usage || 0,
        disk_usage: latestHealth?.disk_usage || 0,
        active_connections: latestHealth?.active_connections || 0,
        active_streams: activeStreams[0]?.count || 0,
        network_in_mbps: latestHealth?.network_in_mbps || 0,
        network_out_mbps: latestHealth?.network_out_mbps || 0,
        uptime_seconds: latestHealth?.uptime_seconds || 0
      },
      streaming_performance: {
        total_measurements: streamMetrics[0]?.total_measurements || 0,
        avg_cpu_usage: Number((streamMetrics[0]?.avg_cpu || 0).toFixed(2)),
        avg_memory_usage: Number((streamMetrics[0]?.avg_memory || 0).toFixed(2)),
        total_dropped_frames: streamMetrics[0]?.total_dropped_frames || 0,
        frame_drop_rate: Number((((streamMetrics[0]?.total_dropped_frames || 0) / ((streamMetrics[0]?.total_measurements || 1) * 1000)) * 100).toFixed(4))
      },
      user_metrics: {
        total_users: userActivity[0]?.total_users || 0,
        active_users: activeUsers[0]?.active_users || 0,
        user_activity_rate: Number(((activeUsers[0]?.active_users || 0) / (userActivity[0]?.total_users || 1) * 100).toFixed(2))
      },
      defects_by_category: defectsByCategory,
      performance_trends: performanceTrends,
      quality_gates: {
        sigma_level_gate: avgSigmaLevel >= 4.0,
        uptime_gate: (latestHealth ? (100 - (latestHealth.cpu_usage * 0.1)) : 99.9) >= 99.9,
        performance_gate: (streamMetrics[0]?.avg_cpu || 0) <= 80,
        error_rate_gate: ((defectsByCategory.reduce((sum, cat) => sum + cat.total_defects, 0) / (apiRequests || 1)) * 100) <= 0.1
      }
    };

    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error('Six Sigma dashboard error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/six-sigma/metrics
// @desc    Get detailed Six Sigma metrics
// @access  Private (Admin only)
router.get('/metrics', auth, authorize('admin'), async (req, res) => {
  try {
    const { category, timeframe = '24h', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

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

    let query = db('six_sigma_metrics')
      .select('*')
      .where('measured_at', '>=', timeFilter)
      .orderBy('measured_at', 'desc')
      .limit(limit)
      .offset(offset);

    if (category) {
      query = query.where('category', category);
    }

    const metrics = await query;

    // Get total count
    let countQuery = db('six_sigma_metrics')
      .count('* as total')
      .where('measured_at', '>=', timeFilter);

    if (category) {
      countQuery = countQuery.where('category', category);
    }

    const [{ total }] = await countQuery;

    res.json({
      success: true,
      data: {
        metrics,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_items: total,
          items_per_page: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get Six Sigma metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/six-sigma/metrics
// @desc    Record new Six Sigma metric
// @access  Private (Admin only)
router.post('/metrics', auth, authorize('admin'), async (req, res) => {
  try {
    const { metric_type, category, value, target, metadata } = req.body;

    if (!metric_type || !category || value === undefined || target === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: metric_type, category, value, target'
      });
    }

    // Calculate sigma level
    const opportunities = target > 0 ? target : 1000000;
    const defects = value;
    const sigma_level = calculateSigmaLevel(defects, opportunities);
    const is_within_spec = sigma_level >= 4.0; // 4 sigma or better

    const [metricId] = await db('six_sigma_metrics').insert({
      metric_type,
      category,
      value,
      target,
      sigma_level,
      is_within_spec,
      metadata: metadata ? JSON.stringify(metadata) : null,
      measured_at: new Date()
    });

    const metric = await db('six_sigma_metrics')
      .where({ id: metricId })
      .first();

    logger.info(`Six Sigma metric recorded: ${category}/${metric_type} - ${sigma_level} sigma`);

    res.status(201).json({
      success: true,
      data: metric
    });
  } catch (error) {
    logger.error('Record Six Sigma metric error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   GET /api/six-sigma/reports
// @desc    Generate Six Sigma compliance reports
// @access  Private (Admin only)
router.get('/reports', auth, authorize('admin'), async (req, res) => {
  try {
    const { timeframe = '30d', format = 'json' } = req.query;

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
      case '90d':
        timeFilter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Overall compliance
    const overallMetrics = await db('six_sigma_metrics')
      .select('category')
      .avg('sigma_level as avg_sigma')
      .count('* as total_measurements')
      .sum('value as total_defects')
      .where('measured_at', '>=', timeFilter)
      .groupBy('category');

    const complianceRate = overallMetrics.filter(m => m.avg_sigma >= 4.0).length / (overallMetrics.length || 1) * 100;

    // Trend analysis
    const trendData = await db('six_sigma_metrics')
      .select()
      .select(db.raw('DATE(measured_at) as date'))
      .avg('sigma_level as avg_sigma')
      .count('* as measurements')
      .sum('value as total_defects')
      .where('measured_at', '>=', timeFilter)
      .groupBy(db.raw('DATE(measured_at)'))
      .orderBy('date', 'asc');

    // Critical defects
    const criticalDefects = await db('six_sigma_metrics')
      .where('sigma_level', '<', 3.0)
      .where('measured_at', '>=', timeFilter)
      .orderBy('measured_at', 'desc');

    const report = {
      generated_at: new Date().toISOString(),
      timeframe,
      summary: {
        overall_compliance_rate: Number(complianceRate.toFixed(2)),
        total_categories: overallMetrics.length,
        compliant_categories: overallMetrics.filter(m => m.avg_sigma >= 4.0).length,
        total_measurements: overallMetrics.reduce((sum, m) => sum + m.total_measurements, 0),
        total_defects: overallMetrics.reduce((sum, m) => sum + m.total_defects, 0),
        average_sigma_level: Number((overallMetrics.reduce((sum, m) => sum + m.avg_sigma, 0) / (overallMetrics.length || 1)).toFixed(2))
      },
      category_breakdown: overallMetrics.map(m => ({
        category: m.category,
        avg_sigma_level: Number(m.avg_sigma.toFixed(2)),
        total_measurements: m.total_measurements,
        total_defects: m.total_defects,
        compliance_status: m.avg_sigma >= 4.0 ? 'COMPLIANT' : 'NON_COMPLIANT'
      })),
      trend_analysis: trendData.map(t => ({
        date: t.date,
        avg_sigma_level: Number(t.avg_sigma.toFixed(2)),
        measurements: t.measurements,
        total_defects: t.total_defects
      })),
      critical_defects: criticalDefects.map(d => ({
        id: d.id,
        category: d.category,
        metric_type: d.metric_type,
        sigma_level: d.sigma_level,
        value: d.value,
        target: d.target,
        measured_at: d.measured_at
      })),
      recommendations: [
        complianceRate < 80 ? 'Implement immediate corrective actions for non-compliant processes' : null,
        overallMetrics.some(m => m.avg_sigma < 3.0) ? 'Critical sigma levels detected - requires urgent attention' : null,
        'Continue monitoring and maintain Six Sigma standards',
        'Regular training and process improvement initiatives recommended'
      ].filter(r => r !== null)
    };

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Generate Six Sigma report error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;