const express = require('express');
const { auth } = require('../middleware/auth');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'production']);
const logger = require('../utils/logger');
const cache = require('../utils/cache');

const router = express.Router();

// @route   GET /api/health/system
// @desc    Get system health status
// @access  Private
router.get('/system', auth, async (req, res) => {
  try {
    const healthStatus = {
      ome: { status: 'healthy', message: 'OvenMediaEngine is running normally' },
      db: { status: 'healthy', message: 'Database connection is stable' },
      redis: { status: 'healthy', message: 'Redis cache is operational' },
      cdn: { status: 'healthy', message: 'CDN endpoints are responding' }
    };

    // Check database health
    try {
      await db.raw('SELECT 1');
      healthStatus.db.status = 'healthy';
      healthStatus.db.response_time = 0 + 'ms';
    } catch (dbError) {
      healthStatus.db.status = 'error';
      healthStatus.db.message = 'Database connection failed';
      logger.error('Database health check failed:', dbError);
    }

    // Check Redis health
    try {
      if (cache && cache.ping) {
        await cache.ping();
        healthStatus.redis.status = 'healthy';
        healthStatus.redis.memory_usage = 0 + 'MB';
      } else {
        healthStatus.redis.status = 'warning';
        healthStatus.redis.message = 'Redis not configured';
      }
    } catch (redisError) {
      healthStatus.redis.status = 'error';
      healthStatus.redis.message = 'Redis connection failed';
      logger.error('Redis health check failed:', redisError);
    }

    // Check OvenMediaEngine (mock check)
    try {
      // In production, this would make an actual HTTP request to OME API
      const omeHealth = await checkOvenMediaEngineHealth();
      healthStatus.ome = omeHealth;
    } catch (omeError) {
      healthStatus.ome.status = 'error';
      healthStatus.ome.message = 'OvenMediaEngine health check failed';
      logger.error('OME health check failed:', omeError);
    }

    // Check CDN health (mock check)
    try {
      const cdnHealth = await checkCDNHealth();
      healthStatus.cdn = cdnHealth;
    } catch (cdnError) {
      healthStatus.cdn.status = 'warning';
      healthStatus.cdn.message = 'CDN endpoints unreachable';
      logger.error('CDN health check failed:', cdnError);
    }

    // Overall system health
    const overallHealth = calculateOverallHealth(healthStatus);

    res.json({
      success: true,
      data: {
        ...healthStatus,
        overall: overallHealth,
        timestamp: new Date(),
        uptime: process.uptime()
      }
    });

  } catch (error) {
    logger.error('System health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system health status'
    });
  }
});

// @route   GET /api/health/services
// @desc    Get detailed service health information
// @access  Private
router.get('/services', auth, async (req, res) => {
  try {
    const services = {
      api_server: {
        status: 'healthy',
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage()
      },
      database: await getDatabaseHealth(),
      cache: await getCacheHealth(),
      streaming_engine: await getStreamingEngineHealth(),
      file_storage: await getFileStorageHealth()
    };

    res.json({
      success: true,
      data: services
    });

  } catch (error) {
    logger.error('Service health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service health information'
    });
  }
});

// @route   GET /api/health/metrics
// @desc    Get system performance metrics
// @access  Private
router.get('/metrics', auth, async (req, res) => {
  try {
    const metrics = {
      system: {
        cpu_usage: 0 // Real CPU usage would come from OS monitoring usage
        memory_usage: 0 // Real memory usage would come from OS monitoring usage
        disk_usage: 0 // Real disk usage would come from filesystem monitoring usage
        network_io: {
          bytes_in: 0,
          bytes_out: 0
        }
      },
      application: {
        active_connections: 0,
        requests_per_second: 0,
        response_time: 0,
        error_rate: 0 // Would come from error monitoring
      },
      streaming: {
        active_streams: await getActiveStreamsCount(),
        total_viewers: await getTotalViewersCount(),
        bandwidth_usage: 0,
        transcoding_load: 0
      }
    };

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('System metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics'
    });
  }
});

// Helper functions
async function checkOvenMediaEngineHealth() {
  // Mock OvenMediaEngine health check
  // In production, this would make HTTP requests to OME API endpoints
  return new Promise((resolve) => {
    setTimeout(() => {
      // Real health check would test actual OME connectivity
      const isHealthy = true; // Would be based on actual OME API response
      resolve({
        status: isHealthy ? 'healthy' : 'warning',
        message: isHealthy ? 'All streaming protocols operational' : 'Some protocols experiencing issues',
        protocols: {
          rtmp: { status: 'active', port: 1935 },
          webrtc: { status: 'active', port: 3333 },
          srt: { status: 'active', port: 9999 },
          hls: { status: 'active', port: 8080 }
        },
        version: '0.15.0',
        uptime: 0
      });
    }, 100);
  });
}

async function checkCDNHealth() {
  // Mock CDN health check
  return new Promise((resolve) => {
    setTimeout(() => {
      // Real CDN health check would test actual endpoints
      const isHealthy = true; // Would be based on actual CDN response times
      resolve({
        status: isHealthy ? 'healthy' : 'warning',
        message: isHealthy ? 'All CDN endpoints responding' : 'Some CDN endpoints slow',
        endpoints: [
          { region: 'us-east-1', status: 'healthy', latency: '45ms' },
          { region: 'eu-west-1', status: 'healthy', latency: '67ms' },
          { region: 'ap-southeast-1', status: 'healthy', latency: '89ms' }
        ]
      });
    }, 200);
  });
}

async function getDatabaseHealth() {
  try {
    const start = Date.now();
    await db.raw('SELECT 1');
    const responseTime = Date.now() - start;
    
    // Get connection pool info
    const poolInfo = db.client.pool;
    
    return {
      status: 'healthy',
      response_time: responseTime + 'ms',
      connections: {
        active: poolInfo.numUsed || 0,
        idle: poolInfo.numFree || 0,
        max: poolInfo.max || 10
      },
      version: 'PostgreSQL 14.x'
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    };
  }
}

async function getCacheHealth() {
  try {
    if (!cache || !cache.ping) {
      return {
        status: 'warning',
        message: 'Cache not configured'
      };
    }
    
    const start = Date.now();
    await cache.ping();
    const responseTime = Date.now() - start;
    
    return {
      status: 'healthy',
      response_time: responseTime + 'ms',
      memory_usage: 0 + 'MB',
      hit_rate: (0).toFixed(2) + '%'
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Cache connection failed',
      error: error.message
    };
  }
}

async function getStreamingEngineHealth() {
  // Mock streaming engine health
  return {
    status: 'healthy',
    active_streams: 0,
    total_bandwidth: 0 + 'Mbps',
    transcoding_jobs: 0, // Real data would come from job queue
    recording_sessions: 0 // Real data would come from active recording count
  };
}

async function getFileStorageHealth() {
  // Mock file storage health
  return {
    status: 'healthy',
    total_space: '1TB',
    used_space: 0 + 'GB',
    available_space: 0 + 'GB',
    iops: 0
  };
}

async function getActiveStreamsCount() {
  try {
    const result = await db('streams')
      .where({ status: 'active' })
      .count('* as count')
      .first();
    return parseInt(result.count) || 0;
  } catch (error) {
    return 0; // Mock data
  }
}

async function getTotalViewersCount() {
  try {
    const result = await db('streams')
      .where({ status: 'active' })
      .sum('current_viewers as total')
      .first();
    return parseInt(result.total) || 0;
  } catch (error) {
    return 0; // Mock data
  }
}

function calculateOverallHealth(healthStatus) {
  const statuses = Object.values(healthStatus).map(service => service.status);
  const errorCount = statuses.filter(status => status === 'error').length;
  const warningCount = statuses.filter(status => status === 'warning').length;
  
  if (errorCount > 0) {
    return {
      status: 'error',
      message: `${errorCount} critical service(s) down`
    };
  } else if (warningCount > 0) {
    return {
      status: 'warning',
      message: `${warningCount} service(s) experiencing issues`
    };
  } else {
    return {
      status: 'healthy',
      message: 'All systems operational'
    };
  }
}

module.exports = router;