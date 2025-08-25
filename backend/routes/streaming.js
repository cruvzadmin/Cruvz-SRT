const express = require('express');
const { auth } = require('../middleware/auth');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const logger = require('../utils/logger');

const router = express.Router();

// @route   POST /api/streaming/webrtc/start
// @desc    Start WebRTC streaming session
// @access  Private
router.post('/webrtc/start', auth, async (req, res) => {
  try {
    const { stream_id, offer } = req.body;

    if (!stream_id || !offer) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID and WebRTC offer required'
      });
    }

    // Verify stream ownership
    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id, protocol: 'webrtc' })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'WebRTC stream not found'
      });
    }

    // Start WebRTC session (in production, this would connect to a WebRTC server)
    const sessionId = `webrtc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update stream status
    await db('streams')
      .where({ id: stream_id })
      .update({
        status: 'active',
        started_at: new Date()
      });

    // Generate WebRTC answer (mock implementation)
    const answer = {
      type: 'answer',
      sdp: `v=0\r\no=- ${Date.now()} 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE audio video\r\na=msid-semantic: WMS stream\r\n`
    };

    logger.info(`WebRTC stream started: ${stream.title} (${sessionId})`);

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        answer,
        ice_servers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
        stream_url: `ws://localhost:3333/webrtc/${stream.stream_key}`,
        status: 'connected'
      }
    });

  } catch (error) {
    logger.error('WebRTC start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start WebRTC stream'
    });
  }
});

// @route   POST /api/streaming/webrtc/stop
// @desc    Stop WebRTC streaming session
// @access  Private
router.post('/webrtc/stop', auth, async (req, res) => {
  try {
    const { stream_id, session_id } = req.body;

    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Update stream status
    await db('streams')
      .where({ id: stream_id })
      .update({
        status: 'ended',
        ended_at: new Date()
      });

    logger.info(`WebRTC stream stopped: ${stream.title} (${session_id})`);

    res.json({
      success: true,
      message: 'WebRTC stream stopped successfully'
    });

  } catch (error) {
    logger.error('WebRTC stop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop WebRTC stream'
    });
  }
});

// @route   POST /api/streaming/srt/start
// @desc    Start SRT streaming session
// @access  Private
router.post('/srt/start', auth, async (req, res) => {
  try {
    const { stream_id, srt_settings } = req.body;

    if (!stream_id) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID required'
      });
    }

    // Verify stream ownership
    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id, protocol: 'srt' })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'SRT stream not found'
      });
    }

    // Start SRT session (in production, this would connect to an SRT server)
    const sessionId = `srt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update stream status
    await db('streams')
      .where({ id: stream_id })
      .update({
        status: 'active',
        started_at: new Date()
      });

    // Generate SRT connection details
    const srtPort = process.env.OME_SRT_PORT || 9999;
    const srtHost = process.env.OME_HOST || 'localhost';

    logger.info(`SRT stream started: ${stream.title} (${sessionId})`);

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        srt_url: `srt://${srtHost}:${srtPort}?streamid=publish/${stream.stream_key}`,
        play_url: `srt://${srtHost}:${srtPort}?streamid=play/${stream.stream_key}`,
        settings: {
          latency: srt_settings?.latency || 125,
          passphrase: srt_settings?.passphrase || null,
          pbkeylen: srt_settings?.pbkeylen || 16
        },
        status: 'connected'
      }
    });

  } catch (error) {
    logger.error('SRT start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start SRT stream'
    });
  }
});

// @route   POST /api/streaming/srt/stop
// @desc    Stop SRT streaming session
// @access  Private
router.post('/srt/stop', auth, async (req, res) => {
  try {
    const { stream_id, session_id } = req.body;

    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Update stream status
    await db('streams')
      .where({ id: stream_id })
      .update({
        status: 'ended',
        ended_at: new Date()
      });

    logger.info(`SRT stream stopped: ${stream.title} (${session_id})`);

    res.json({
      success: true,
      message: 'SRT stream stopped successfully'
    });

  } catch (error) {
    logger.error('SRT stop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop SRT stream'
    });
  }
});

// @route   POST /api/streaming/rtmp/start
// @desc    Start RTMP streaming session
// @access  Private
router.post('/rtmp/start', auth, async (req, res) => {
  try {
    const { stream_id, rtmp_settings } = req.body;

    if (!stream_id) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID required'
      });
    }

    // Verify stream ownership
    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id, protocol: 'rtmp' })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'RTMP stream not found'
      });
    }

    // Start RTMP session (in production, this would connect to an RTMP server)
    const sessionId = `rtmp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update stream status
    await db('streams')
      .where({ id: stream_id })
      .update({
        status: 'active',
        started_at: new Date()
      });

    // Generate RTMP connection details
    const rtmpPort = process.env.OME_RTMP_PORT || 1935;
    const rtmpHost = process.env.OME_HOST || 'localhost';

    logger.info(`RTMP stream started: ${stream.title} (${sessionId})`);

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        rtmp_url: `rtmp://${rtmpHost}:${rtmpPort}/live/${stream.stream_key}`,
        play_url: `rtmp://${rtmpHost}:${rtmpPort}/play/${stream.stream_key}`,
        hls_url: `http://${rtmpHost}:8080/hls/${stream.stream_key}/index.m3u8`,
        dash_url: `http://${rtmpHost}:8080/dash/${stream.stream_key}/manifest.mpd`,
        settings: {
          video_codec: rtmp_settings?.video_codec || 'h264',
          audio_codec: rtmp_settings?.audio_codec || 'aac',
          video_bitrate: rtmp_settings?.video_bitrate || 2500,
          audio_bitrate: rtmp_settings?.audio_bitrate || 128
        },
        status: 'connected'
      }
    });

  } catch (error) {
    logger.error('RTMP start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start RTMP stream'
    });
  }
});

// @route   POST /api/streaming/rtmp/stop
// @desc    Stop RTMP streaming session
// @access  Private
router.post('/rtmp/stop', auth, async (req, res) => {
  try {
    const { stream_id, session_id } = req.body;

    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Update stream status
    await db('streams')
      .where({ id: stream_id })
      .update({
        status: 'ended',
        ended_at: new Date()
      });

    logger.info(`RTMP stream stopped: ${stream.title} (${session_id})`);

    res.json({
      success: true,
      message: 'RTMP stream stopped successfully'
    });

  } catch (error) {
    logger.error('RTMP stop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop RTMP stream'
    });
  }
});

// @route   GET /api/streaming/status/:stream_id
// @desc    Get streaming session status
// @access  Private
router.get('/status/:stream_id', auth, async (req, res) => {
  try {
    const stream = await db('streams')
      .where({ id: req.params.stream_id, user_id: req.user.id })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Get real-time streaming metrics (mock implementation)
    const metrics = {
      status: stream.status,
      protocol: stream.protocol,
      started_at: stream.started_at,
      ended_at: stream.ended_at,
      current_viewers: stream.current_viewers || 0,
      bitrate: 2500, // Mock bitrate
      fps: 30, // Mock FPS
      resolution: '1920x1080', // Mock resolution
      latency: stream.protocol === 'srt' ? 125 : stream.protocol === 'webrtc' ? 50 : 3000,
      quality_score: 98.5 // Mock quality score
    };

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Stream status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stream status'
    });
  }
});

module.exports = router;