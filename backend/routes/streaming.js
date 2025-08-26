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

// @route   POST /api/streaming/llhls/start
// @desc    Start Low Latency HLS streaming session
// @access  Private
router.post('/llhls/start', auth, async (req, res) => {
  try {
    const { stream_id, llhls_settings } = req.body;

    if (!stream_id) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID required'
      });
    }

    // Verify stream ownership
    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Configure LLHLS settings
    const llhlsConfig = {
      segment_duration: llhls_settings?.segment_duration || 2000, // 2 seconds
      part_duration: llhls_settings?.part_duration || 500, // 500ms
      partial_segments: llhls_settings?.partial_segments || 6,
      target_latency: llhls_settings?.target_latency || 3000,
      ...llhls_settings
    };

    // Update stream with LLHLS configuration
    await db('streams')
      .where({ id: stream_id })
      .update({
        status: 'active',
        protocol: 'llhls',
        started_at: new Date(),
        settings: JSON.stringify({
          llhls: llhlsConfig,
          quality: '1080p',
          bitrate: 5000
        })
      });

    // Generate LLHLS URLs
    const sessionId = `llhls_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const playlistUrl = `https://your-domain.com/live/${stream.stream_key}/playlist.m3u8`;
    const partialPlaylistUrl = `https://your-domain.com/live/${stream.stream_key}/playlist_ll.m3u8`;

    logger.info(`LLHLS stream started: ${stream.title} by user ${req.user.email}`);

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        protocol: 'llhls',
        config: llhlsConfig,
        urls: {
          playlist: playlistUrl,
          partial_playlist: partialPlaylistUrl,
          stats: `https://your-domain.com/stats/${stream.stream_key}`
        },
        estimated_latency: llhlsConfig.target_latency
      }
    });

  } catch (error) {
    logger.error('LLHLS start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start LLHLS stream'
    });
  }
});

// @route   POST /api/streaming/ovt/start  
// @desc    Start OVT (OvenPlayer WebRTC Transport) streaming session
// @access  Private
router.post('/ovt/start', auth, async (req, res) => {
  try {
    const { stream_id, ovt_settings } = req.body;

    if (!stream_id) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID required'
      });
    }

    // Verify stream ownership
    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Configure OVT settings for ultra-low latency
    const ovtConfig = {
      transport: 'tcp',
      latency_mode: 'ultra_low',
      max_bitrate: ovt_settings?.max_bitrate || 8000000,
      min_bitrate: ovt_settings?.min_bitrate || 1000000,
      adaptive_bitrate: ovt_settings?.adaptive_bitrate !== false,
      ...ovt_settings
    };

    // Update stream with OVT configuration
    await db('streams')
      .where({ id: stream_id })
      .update({
        status: 'active',
        protocol: 'ovt',
        started_at: new Date(),
        settings: JSON.stringify({
          ovt: ovtConfig,
          quality: '1080p',
          target_latency: 50
        })
      });

    const sessionId = `ovt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ovtUrl = `wss://your-domain.com/ovt/${stream.stream_key}`;

    logger.info(`OVT stream started: ${stream.title} by user ${req.user.email}`);

    res.json({
      success: true,
      data: {
        session_id: sessionId,
        protocol: 'ovt',
        config: ovtConfig,
        urls: {
          websocket: ovtUrl,
          player: `https://your-domain.com/player/${stream.stream_key}`,
          stats: `https://your-domain.com/stats/${stream.stream_key}`
        },
        estimated_latency: 50
      }
    });

  } catch (error) {
    logger.error('OVT start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start OVT stream'
    });
  }
});

// @route   POST /api/streaming/recording/start
// @desc    Start recording for a stream
// @access  Private
router.post('/recording/start', auth, async (req, res) => {
  try {
    const { stream_id, recording_settings } = req.body;

    if (!stream_id) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID required'
      });
    }

    // Verify stream ownership and that stream is active
    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id })
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
        error: 'Stream must be active to start recording'
      });
    }

    // Configure recording settings
    const recordingConfig = {
      format: recording_settings?.format || 'mp4',
      quality: recording_settings?.quality || '1080p',
      bitrate: recording_settings?.bitrate || 5000,
      segment_duration: recording_settings?.segment_duration || 3600, // 1 hour segments
      storage_path: recording_settings?.storage_path || `/recordings/${stream.stream_key}`,
      auto_delete_after: recording_settings?.auto_delete_after || 2592000, // 30 days
      ...recording_settings
    };

    // Update stream to enable recording
    await db('streams')
      .where({ id: stream_id })
      .update({
        is_recording: true,
        recording_url: `/recordings/${stream.stream_key}/${Date.now()}.${recordingConfig.format}`
      });

    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info(`Recording started for stream: ${stream.title} by user ${req.user.email}`);

    res.json({
      success: true,
      data: {
        recording_id: recordingId,
        stream_id,
        config: recordingConfig,
        started_at: new Date().toISOString(),
        estimated_file_size: '~2GB per hour',
        storage_location: recordingConfig.storage_path
      }
    });

  } catch (error) {
    logger.error('Recording start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start recording'
    });
  }
});

// @route   POST /api/streaming/recording/stop
// @desc    Stop recording for a stream
// @access  Private
router.post('/recording/stop', auth, async (req, res) => {
  try {
    const { stream_id, recording_id } = req.body;

    if (!stream_id) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID required'
      });
    }

    // Verify stream ownership
    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Update stream to disable recording
    await db('streams')
      .where({ id: stream_id })
      .update({
        is_recording: false
      });

    logger.info(`Recording stopped for stream: ${stream.title} by user ${req.user.email}`);

    res.json({
      success: true,
      data: {
        recording_id,
        stream_id,
        stopped_at: new Date().toISOString(),
        final_location: stream.recording_url,
        status: 'processing'
      }
    });

  } catch (error) {
    logger.error('Recording stop error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop recording'
    });
  }
});

// @route   POST /api/streaming/transcode/configure
// @desc    Configure transcoding settings for a stream
// @access  Private
router.post('/transcode/configure', auth, async (req, res) => {
  try {
    const { stream_id, transcode_settings } = req.body;

    if (!stream_id || !transcode_settings) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID and transcode settings required'
      });
    }

    // Verify stream ownership
    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Configure transcoding profiles
    const transcodeConfig = {
      profiles: transcode_settings.profiles || [
        {
          name: '1080p',
          video: { width: 1920, height: 1080, bitrate: 5000, fps: 30, codec: 'h264' },
          audio: { bitrate: 192, codec: 'aac', channels: 2 }
        },
        {
          name: '720p',
          video: { width: 1280, height: 720, bitrate: 3000, fps: 30, codec: 'h264' },
          audio: { bitrate: 128, codec: 'aac', channels: 2 }
        },
        {
          name: '480p',
          video: { width: 854, height: 480, bitrate: 1500, fps: 30, codec: 'h264' },
          audio: { bitrate: 96, codec: 'aac', channels: 2 }
        }
      ],
      hardware_acceleration: transcode_settings.hardware_acceleration || 'auto',
      adaptive_bitrate: transcode_settings.adaptive_bitrate !== false,
      preset: transcode_settings.preset || 'faster',
      ...transcode_settings
    };

    // Update stream with transcoding configuration
    const currentSettings = stream.settings ? JSON.parse(stream.settings) : {};
    currentSettings.transcoding = transcodeConfig;

    await db('streams')
      .where({ id: stream_id })
      .update({
        settings: JSON.stringify(currentSettings)
      });

    logger.info(`Transcoding configured for stream: ${stream.title} by user ${req.user.email}`);

    res.json({
      success: true,
      data: {
        stream_id,
        config: transcodeConfig,
        profiles_count: transcodeConfig.profiles.length,
        estimated_cpu_usage: '40-60%',
        urls: transcodeConfig.profiles.map(profile => ({
          quality: profile.name,
          url: `https://your-domain.com/live/${stream.stream_key}/${profile.name}/playlist.m3u8`
        }))
      }
    });

  } catch (error) {
    logger.error('Transcode configure error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure transcoding'
    });
  }
});

// @route   POST /api/streaming/push/configure
// @desc    Configure push publishing to external services
// @access  Private
router.post('/push/configure', auth, async (req, res) => {
  try {
    const { stream_id, push_settings } = req.body;

    if (!stream_id || !push_settings) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID and push settings required'
      });
    }

    // Verify stream ownership
    const stream = await db('streams')
      .where({ id: stream_id, user_id: req.user.id })
      .first();

    if (!stream) {
      return res.status(404).json({
        success: false,
        error: 'Stream not found'
      });
    }

    // Configure push publishing targets
    const pushConfig = {
      targets: push_settings.targets || [],
      retry_count: push_settings.retry_count || 3,
      retry_delay: push_settings.retry_delay || 5000,
      health_check_interval: push_settings.health_check_interval || 30000,
      ...push_settings
    };

    // Validate push targets
    for (const target of pushConfig.targets) {
      if (!target.url || !target.name) {
        return res.status(400).json({
          success: false,
          error: 'Each push target must have a name and URL'
        });
      }
    }

    // Update stream with push configuration
    const currentSettings = stream.settings ? JSON.parse(stream.settings) : {};
    currentSettings.push_publishing = pushConfig;

    await db('streams')
      .where({ id: stream_id })
      .update({
        settings: JSON.stringify(currentSettings)
      });

    logger.info(`Push publishing configured for stream: ${stream.title} by user ${req.user.email}`);

    res.json({
      success: true,
      data: {
        stream_id,
        config: pushConfig,
        targets_count: pushConfig.targets.length,
        status: 'configured',
        targets: pushConfig.targets.map(target => ({
          name: target.name,
          url: target.url,
          status: 'ready'
        }))
      }
    });

  } catch (error) {
    logger.error('Push configure error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure push publishing'
    });
  }
});

module.exports = router;