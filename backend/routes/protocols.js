const express = require('express');
const { auth } = require('../middleware/auth');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const logger = require('../utils/logger');
const axios = require('axios');

const router = express.Router();

// OvenMediaEngine API configuration
const OME_API_BASE = process.env.OME_API_URL || 'http://localhost:8080';
const OME_API_KEY = process.env.OME_API_KEY || '';

// Helper function to make OME API requests
async function omeApiRequest(endpoint, options = {}) {
  try {
    const config = {
      method: 'GET',
      baseURL: OME_API_BASE,
      headers: {
        'Content-Type': 'application/json',
        ...(OME_API_KEY && { 'Authorization': `Bearer ${OME_API_KEY}` })
      },
      timeout: 5000,
      ...options
    };

    const response = await axios(endpoint, config);
    return { success: true, data: response.data };
  } catch (error) {
    logger.error(`OME API Error (${endpoint}):`, error.message);
    return { 
      success: false, 
      error: error.response?.data?.message || error.message 
    };
  }
}

// @route   GET /api/streaming/protocols/:protocol/status
// @desc    Check protocol status
// @access  Private
router.get('/protocols/:protocol/status', auth, async (req, res) => {
  try {
    const { protocol } = req.params;
    
    const protocolConfigs = {
      rtmp: { port: 1935, endpoint: '/v1/stats/current' },
      srt: { port: 9999, endpoint: '/v1/stats/current' },
      webrtc: { port: 3333, endpoint: '/v1/stats/current' },
      llhls: { port: 8090, endpoint: '/v1/stats/current' },
      ovt: { port: 9000, endpoint: '/v1/stats/current' },
      api: { port: 8080, endpoint: '/v1/stats/current' }
    };

    const config = protocolConfigs[protocol];
    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported protocol'
      });
    }

    // Check if OME API is accessible for this protocol
    const omeResponse = await omeApiRequest(config.endpoint);
    
    // Check database for protocol configuration
    let dbConfig = null;
    try {
      dbConfig = await db('protocol_configs')
        .where({ protocol, user_id: req.user.id })
        .first();
    } catch (dbError) {
      logger.warn(`Database not available for protocol config: ${dbError.message}`);
    }

    res.json({
      success: true,
      data: {
        protocol,
        status: omeResponse.success ? 'active' : 'error',
        port: config.port,
        ome_api_available: omeResponse.success,
        configuration: dbConfig,
        last_checked: new Date().toISOString(),
        error: omeResponse.error || null
      }
    });

  } catch (error) {
    logger.error('Protocol status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check protocol status'
    });
  }
});

// @route   POST /api/streaming/protocols/:protocol/test
// @desc    Test protocol connection
// @access  Private
router.post('/protocols/:protocol/test', auth, async (req, res) => {
  try {
    const { protocol } = req.params;
    
    const testEndpoints = {
      rtmp: '/v1/stats/current',
      srt: '/v1/stats/current', 
      webrtc: '/v1/stats/current',
      llhls: '/v1/stats/current',
      ovt: '/v1/stats/current',
      api: '/v1/stats/current'
    };

    const endpoint = testEndpoints[protocol];
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported protocol'
      });
    }

    const testResult = await omeApiRequest(endpoint);
    
    // Log test result
    try {
      await db('protocol_tests').insert({
        user_id: req.user.id,
        protocol,
        status: testResult.success ? 'success' : 'failed',
        result: JSON.stringify(testResult),
        tested_at: new Date()
      });
    } catch (dbError) {
      logger.warn('Could not log protocol test to database');
    }

    res.json({
      success: testResult.success,
      data: {
        protocol,
        test_result: testResult.success ? 'passed' : 'failed',
        response_time: testResult.response_time || null,
        error: testResult.error || null,
        timestamp: new Date().toISOString()
      },
      error: testResult.success ? null : testResult.error
    });

  } catch (error) {
    logger.error('Protocol test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test protocol connection'
    });
  }
});

// @route   GET /api/streaming/protocols/:protocol/config
// @desc    Get protocol configuration
// @access  Private
router.get('/protocols/:protocol/config', auth, async (req, res) => {
  try {
    const { protocol } = req.params;
    
    // Get user's protocol configuration
    const config = await db('protocol_configs')
      .where({ protocol, user_id: req.user.id })
      .first();

    if (!config) {
      // Return default configuration
      const defaultConfigs = {
        rtmp: {
          protocol: 'rtmp',
          ingestion_url: 'rtmp://localhost:1935/app/',
          port: 1935,
          max_connections: 1000,
          chunk_size: 4096,
          timeout: 30000
        },
        srt: {
          protocol: 'srt',
          ingestion_url: 'srt://localhost:9999',
          port: 9999,
          latency: 120,
          max_bandwidth: 100000000,
          encryption: false
        },
        webrtc: {
          protocol: 'webrtc',
          signaling_url: 'ws://localhost:3333/webrtc',
          port: 3333,
          stun_servers: ['stun:stun.l.google.com:19302'],
          turn_servers: [],
          ice_candidate_timeout: 5000
        },
        llhls: {
          protocol: 'llhls',
          playback_url: 'http://localhost:8090/app/stream.m3u8',
          port: 8090,
          segment_duration: 1,
          target_latency: 3,
          segment_count: 10
        },
        ovt: {
          protocol: 'ovt',
          ingestion_url: 'ovt://localhost:9000/app/stream',
          port: 9000,
          timeout: 10000,
          max_connections: 500
        }
      };

      const defaultConfig = defaultConfigs[protocol];
      if (!defaultConfig) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported protocol'
        });
      }

      return res.json({
        success: true,
        data: defaultConfig
      });
    }

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Protocol config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get protocol configuration'
    });
  }
});

// @route   PUT /api/streaming/protocols/:protocol/config
// @desc    Update protocol configuration
// @access  Private
router.put('/protocols/:protocol/config', auth, async (req, res) => {
  try {
    const { protocol } = req.params;
    const updates = req.body;

    // Validate protocol
    const supportedProtocols = ['rtmp', 'srt', 'webrtc', 'llhls', 'ovt'];
    if (!supportedProtocols.includes(protocol)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported protocol'
      });
    }

    // Check if config exists
    const existingConfig = await db('protocol_configs')
      .where({ protocol, user_id: req.user.id })
      .first();

    const configData = {
      protocol,
      user_id: req.user.id,
      configuration: JSON.stringify(updates),
      updated_at: new Date()
    };

    if (existingConfig) {
      await db('protocol_configs')
        .where({ protocol, user_id: req.user.id })
        .update(configData);
    } else {
      configData.created_at = new Date();
      await db('protocol_configs').insert(configData);
    }

    logger.info(`Protocol configuration updated: ${protocol} for user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        protocol,
        message: 'Configuration updated successfully',
        configuration: updates
      }
    });

  } catch (error) {
    logger.error('Protocol config update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update protocol configuration'
    });
  }
});

// @route   GET /api/streaming/protocols/status
// @desc    Get all protocols status
// @access  Private
router.get('/protocols/status', auth, async (req, res) => {
  try {
    const protocols = ['rtmp', 'srt', 'webrtc', 'llhls', 'ovt', 'api'];
    const statusPromises = protocols.map(async (protocol) => {
      try {
        const omeResponse = await omeApiRequest('/v1/stats/current');
        return {
          protocol,
          status: omeResponse.success ? 'active' : 'error',
          last_checked: new Date().toISOString()
        };
      } catch (error) {
        return {
          protocol,
          status: 'error',
          error: error.message,
          last_checked: new Date().toISOString()
        };
      }
    });

    const results = await Promise.allSettled(statusPromises);
    const protocolStatus = results.map((result, index) => 
      result.status === 'fulfilled' ? result.value : {
        protocol: protocols[index],
        status: 'error',
        error: 'Failed to check status'
      }
    );

    res.json({
      success: true,
      data: {
        protocols: protocolStatus,
        overall_status: protocolStatus.every(p => p.status === 'active') ? 'operational' : 'degraded',
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Protocols status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get protocols status'
    });
  }
});

// @route   GET /api/streaming/ome/stats
// @desc    Get OvenMediaEngine statistics
// @access  Private
router.get('/ome/stats', auth, async (req, res) => {
  try {
    const statsResponse = await omeApiRequest('/v1/stats/current');
    
    if (!statsResponse.success) {
      return res.status(503).json({
        success: false,
        error: 'OvenMediaEngine API not available',
        details: statsResponse.error
      });
    }

    res.json({
      success: true,
      data: {
        ome_stats: statsResponse.data,
        api_status: 'connected',
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('OME stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OvenMediaEngine statistics'
    });
  }
});

// @route   GET /api/streaming/ome/applications
// @desc    Get OvenMediaEngine applications
// @access  Private
router.get('/ome/applications', auth, async (req, res) => {
  try {
    const appsResponse = await omeApiRequest('/v1/vhosts/default/apps');
    
    if (!appsResponse.success) {
      return res.status(503).json({
        success: false,
        error: 'OvenMediaEngine API not available'
      });
    }

    res.json({
      success: true,
      data: appsResponse.data
    });

  } catch (error) {
    logger.error('OME applications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OvenMediaEngine applications'
    });
  }
});

// @route   GET /api/streaming/ome/streams
// @desc    Get OvenMediaEngine streams
// @access  Private
router.get('/ome/streams', auth, async (req, res) => {
  try {
    const streamsResponse = await omeApiRequest('/v1/vhosts/default/apps/app/streams');
    
    if (!streamsResponse.success) {
      return res.status(503).json({
        success: false,
        error: 'OvenMediaEngine streams not available'
      });
    }

    res.json({
      success: true,
      data: streamsResponse.data
    });

  } catch (error) {
    logger.error('OME streams error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OvenMediaEngine streams'
    });
  }
});

module.exports = router;