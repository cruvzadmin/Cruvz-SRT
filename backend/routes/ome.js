const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'production']);
const logger = require('../utils/logger');

const router = express.Router();

// OvenMediaEngine configuration
const OME_API_URL = process.env.OME_API_URL || 'http://localhost:8080';
const OME_API_TOKEN = process.env.OME_ACCESS_TOKEN || 'cruvz-production-api-token-2025';

// Helper function to call OvenMediaEngine API
async function callOmeApi(endpoint, method = 'GET', data = null) {
  try {
    const config = {
      method,
      url: `${OME_API_URL}${endpoint}`,
      headers: {
        'Authorization': OME_API_TOKEN,
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return {
      success: true,
      data: response.data,
      status: response.status
    };
  } catch (error) {
    logger.error('OME API call failed:', {
      endpoint,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    return {
      success: false,
      error: error.message,
      status: error.response?.status || 500,
      data: error.response?.data
    };
  }
}

// @route   GET /api/ome/stats
// @desc    Get complete OvenMediaEngine statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const result = await callOmeApi('/v1/stats/current');
    
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: 'Failed to fetch OME statistics',
        details: result.error
      });
    }
    
    // Store metrics in database for historical tracking
    const timestamp = new Date();
    const stats = result.data;
    
    // Extract key metrics
    const metrics = {
      total_connections: stats.totalConnections || 0,
      input_connections: stats.inputConnections || 0,
      output_connections: stats.outputConnections || 0,
      cpu_usage: stats.cpuUsage || 0,
      memory_usage: stats.memoryUsage || 0,
      network_sent_bytes: stats.networkSentBytes || 0,
      network_recv_bytes: stats.networkRecvBytes || 0
    };
    
    // Store in six_sigma_metrics table
    for (const [metricName, value] of Object.entries(metrics)) {
      await db('six_sigma_metrics').insert({
        metric_name: `ome_${metricName}`,
        metric_value: value,
        timestamp,
        category: 'streaming_engine'
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      timestamp
    });
    
  } catch (error) {
    logger.error('Error fetching OME stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   GET /api/ome/vhosts
// @desc    Get virtual hosts configuration
// @access  Private
router.get('/vhosts', auth, async (req, res) => {
  try {
    const result = await callOmeApi('/v1/vhosts');
    
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: 'Failed to fetch virtual hosts',
        details: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    logger.error('Error fetching vhosts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   GET /api/ome/vhosts/:vhost/apps
// @desc    Get applications for a virtual host
// @access  Private
router.get('/vhosts/:vhost/apps', auth, async (req, res) => {
  try {
    const { vhost } = req.params;
    const result = await callOmeApi(`/v1/vhosts/${vhost}/apps`);
    
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: 'Failed to fetch applications',
        details: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    logger.error('Error fetching apps:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   GET /api/ome/vhosts/:vhost/apps/:app/streams
// @desc    Get streams for an application
// @access  Private
router.get('/vhosts/:vhost/apps/:app/streams', auth, async (req, res) => {
  try {
    const { vhost, app } = req.params;
    const result = await callOmeApi(`/v1/vhosts/${vhost}/apps/${app}/streams`);
    
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: 'Failed to fetch streams',
        details: result.error
      });
    }
    
    // Update our database with current stream states
    const streams = result.data.response || [];
    for (const stream of streams) {
      const existingStream = await db('streams')
        .where({ stream_key: stream.name })
        .first();
        
      if (existingStream) {
        await db('streams')
          .where({ stream_key: stream.name })
          .update({
            status: 'live',
            updated_at: new Date()
          });
          
        // Record analytics
        await db('analytics').insert({
          stream_id: existingStream.id,
          viewers: stream.connections?.length || 0,
          bitrate_kbps: stream.bitrate || 0,
          timestamp: new Date()
        });
      }
    }
    
    res.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    logger.error('Error fetching streams:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   POST /api/ome/vhosts/:vhost/apps/:app/streams/:stream/start_recording
// @desc    Start recording a stream
// @access  Private
router.post('/vhosts/:vhost/apps/:app/streams/:stream/start_recording', auth, async (req, res) => {
  try {
    const { vhost, app, stream } = req.params;
    const { filePath, info } = req.body;
    
    const recordData = {
      id: `record_${Date.now()}`,
      stream: {
        name: stream,
        tracks: info?.tracks || []
      },
      filePath: filePath || `/recordings/${stream}_${Date.now()}.mp4`,
      info: info || {}
    };
    
    const result = await callOmeApi(
      `/v1/vhosts/${vhost}/apps/${app}/streams/${stream}:startRecord`,
      'POST',
      recordData
    );
    
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: 'Failed to start recording',
        details: result.error
      });
    }
    
    // Update database
    const dbStream = await db('streams').where({ stream_key: stream }).first();
    if (dbStream) {
      await db('streams')
        .where({ stream_key: stream })
        .update({
          settings: db.raw(`settings || ?`, [JSON.stringify({ recording: true, recordId: recordData.id })])
        });
    }
    
    res.json({
      success: true,
      data: result.data,
      recordId: recordData.id
    });
    
  } catch (error) {
    logger.error('Error starting recording:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   POST /api/ome/vhosts/:vhost/apps/:app/streams/:stream/stop_recording
// @desc    Stop recording a stream
// @access  Private
router.post('/vhosts/:vhost/apps/:app/streams/:stream/stop_recording', auth, async (req, res) => {
  try {
    const { vhost, app, stream } = req.params;
    const { recordId } = req.body;
    
    const result = await callOmeApi(
      `/v1/vhosts/${vhost}/apps/${app}/streams/${stream}:stopRecord`,
      'POST',
      { id: recordId }
    );
    
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: 'Failed to stop recording',
        details: result.error
      });
    }
    
    // Update database
    const dbStream = await db('streams').where({ stream_key: stream }).first();
    if (dbStream) {
      await db('streams')
        .where({ stream_key: stream })
        .update({
          settings: db.raw(`settings || ?`, [JSON.stringify({ recording: false })])
        });
    }
    
    res.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    logger.error('Error stopping recording:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   POST /api/ome/vhosts/:vhost/apps/:app/streams/:stream/push
// @desc    Start push publishing to external RTMP
// @access  Private
router.post('/vhosts/:vhost/apps/:app/streams/:stream/push', auth, async (req, res) => {
  try {
    const { vhost, app, stream } = req.params;
    const { rtmpUrl, streamKey } = req.body;
    
    if (!rtmpUrl || !streamKey) {
      return res.status(400).json({
        success: false,
        error: 'RTMP URL and stream key are required'
      });
    }
    
    const pushData = {
      id: `push_${Date.now()}`,
      stream: {
        name: stream,
        tracks: []
      },
      protocol: 'rtmp',
      url: `${rtmpUrl}/${streamKey}`,
      streamKey: streamKey
    };
    
    const result = await callOmeApi(
      `/v1/vhosts/${vhost}/apps/${app}/streams/${stream}:startPush`,
      'POST',
      pushData
    );
    
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: 'Failed to start push',
        details: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data,
      pushId: pushData.id
    });
    
  } catch (error) {
    logger.error('Error starting push:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   DELETE /api/ome/vhosts/:vhost/apps/:app/streams/:stream/push/:pushId
// @desc    Stop push publishing
// @access  Private
router.delete('/vhosts/:vhost/apps/:app/streams/:stream/push/:pushId', auth, async (req, res) => {
  try {
    const { vhost, app, stream, pushId } = req.params;
    
    const result = await callOmeApi(
      `/v1/vhosts/${vhost}/apps/${app}/streams/${stream}:stopPush`,
      'POST',
      { id: pushId }
    );
    
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        error: 'Failed to stop push',
        details: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.data
    });
    
  } catch (error) {
    logger.error('Error stopping push:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// @route   GET /api/ome/health
// @desc    Get OvenMediaEngine health status
// @access  Public
router.get('/health', async (req, res) => {
  try {
    const result = await callOmeApi('/v1/stats/current');
    
    const isHealthy = result.success && result.status === 200;
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      details: result.success ? 'OME is responding' : result.error
    });
    
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'OME health check failed'
    });
  }
});

// @route   GET /api/ome/protocols
// @desc    Get available streaming protocols and their status
// @access  Private
router.get('/protocols', auth, async (req, res) => {
  try {
    const statsResult = await callOmeApi('/v1/stats/current');
    const vhostsResult = await callOmeApi('/v1/vhosts');
    
    if (!statsResult.success || !vhostsResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch protocol information'
      });
    }
    
    const stats = statsResult.data;
    const protocols = {
      rtmp: {
        name: 'RTMP',
        port: 1935,
        status: 'active',
        description: 'Real-Time Messaging Protocol for streaming from OBS/FFmpeg',
        endpoint: 'rtmp://your-server:1935/app/{stream_key}',
        connections: stats.inputConnections?.rtmp || 0
      },
      srt: {
        name: 'SRT',
        input_port: 9999,
        output_port: 9998,
        status: 'active',
        description: 'Secure Reliable Transport for low-latency streaming',
        input_endpoint: 'srt://your-server:9999?streamid=input/app/{stream_key}',
        output_endpoint: 'srt://your-server:9998?streamid=app/{stream_key}',
        connections: stats.inputConnections?.srt || 0
      },
      webrtc: {
        name: 'WebRTC',
        signaling_port: 3333,
        signaling_tls_port: 3334,
        status: 'active',
        description: 'Web Real-Time Communication for browser-based streaming',
        signaling_endpoint: 'ws://your-server:3333/app/{stream_key}',
        connections: stats.outputConnections?.webrtc || 0
      },
      llhls: {
        name: 'LL-HLS',
        port: 8088,
        tls_port: 8089,
        status: 'active',
        description: 'Low Latency HTTP Live Streaming',
        endpoint: 'http://your-server:8088/app/{stream_key}/llhls.m3u8',
        connections: stats.outputConnections?.llhls || 0
      },
      hls: {
        name: 'HLS',
        port: 8088,
        status: 'active',
        description: 'HTTP Live Streaming',
        endpoint: 'http://your-server:8088/app/{stream_key}/playlist.m3u8',
        connections: stats.outputConnections?.hls || 0
      },
      thumbnail: {
        name: 'Thumbnail',
        port: 8081,
        tls_port: 8082,
        status: 'active',
        description: 'Stream thumbnail/preview images',
        endpoint: 'http://your-server:8081/app/{stream_key}/thumb.jpg',
        connections: stats.outputConnections?.thumbnail || 0
      }
    };
    
    res.json({
      success: true,
      data: {
        protocols,
        total_input_connections: stats.inputConnections?.total || 0,
        total_output_connections: stats.outputConnections?.total || 0,
        server_status: 'healthy',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    logger.error('Error fetching protocols:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;