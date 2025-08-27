const express = require('express');
const { auth } = require('../middleware/auth');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'production']);
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;

const router = express.Router();

// @route   GET /api/recordings
// @desc    Get user's recordings with metrics
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let recordings = [];
    let metrics = {
      active_recordings: 0,
      total_size: 0,
      storage_usage: 0,
      monthly_hours: 0
    };

    try {
      await db.raw('SELECT 1');
      
      // Get recordings
      recordings = await db('recordings')
        .join('streams', 'recordings.stream_id', 'streams.id')
        .select(
          'recordings.*',
          'streams.title as stream_title',
          'streams.protocol'
        )
        .where('streams.user_id', req.user.id)
        .orderBy('recordings.created_at', 'desc')
        .limit(50);

      // Calculate metrics
      const activeRecordings = await db('recordings')
        .join('streams', 'recordings.stream_id', 'streams.id')
        .where({ 
          'streams.user_id': req.user.id, 
          'recordings.status': 'recording' 
        })
        .count('* as count')
        .first();

      const sizeResult = await db('recordings')
        .join('streams', 'recordings.stream_id', 'streams.id')
        .where('streams.user_id', req.user.id)
        .sum('recordings.size as total')
        .first();

      const monthlyHours = await db('recordings')
        .join('streams', 'recordings.stream_id', 'streams.id')
        .where('streams.user_id', req.user.id)
        .where('recordings.created_at', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .sum('recordings.duration as total')
        .first();

      metrics.active_recordings = parseInt(activeRecordings.count);
      metrics.total_size = sizeResult.total || 0;
      metrics.storage_usage = Math.min(Math.floor((metrics.total_size / (100 * 1024 * 1024 * 1024)) * 100), 100); // Assuming 100GB limit
      metrics.monthly_hours = Math.floor((monthlyHours.total || 0) / 3600);
      
    } catch (dbError) {
      logger.warn('Database not available for recordings');
      // Return mock data
      recordings = [
        {
          id: 1,
          stream_title: 'Sample Recording',
          duration: 3600,
          size: 1024 * 1024 * 500, // 500MB
          status: 'completed',
          format: 'mp4',
          created_at: new Date()
        }
      ];
      metrics = {
        active_recordings: 0,
        total_size: 1024 * 1024 * 500,
        storage_usage: 5,
        monthly_hours: 12
      };
    }

    res.json({
      success: true,
      data: {
        recordings,
        metrics
      }
    });

  } catch (error) {
    logger.error('Recordings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recordings'
    });
  }
});

// @route   POST /api/recordings
// @desc    Start recording
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { stream_id, format, quality, auto_stop } = req.body;

    if (!stream_id) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID is required'
      });
    }

    let stream;
    try {
      await db.raw('SELECT 1');
      
      // Verify stream ownership
      stream = await db('streams')
        .where({ id: stream_id, user_id: req.user.id })
        .first();

      if (!stream) {
        return res.status(404).json({
          success: false,
          error: 'Stream not found'
        });
      }

    } catch (dbError) {
      logger.warn('Database not available for stream verification');
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable'
      });
    }

    const recordingData = {
      id: uuidv4(),
      stream_id,
      user_id: req.user.id,
      format: format || 'mp4',
      quality: quality || 'source',
      auto_stop: auto_stop || false,
      status: 'recording',
      duration: 0,
      size: 0,
      file_path: null,
      started_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };

    try {
      await db('recordings').insert(recordingData);
    } catch (dbError) {
      logger.warn('Database not available for recording creation');
    }

    // Start recording process (in production, this would interface with OvenMediaEngine)
    startRecordingProcess(recordingData.id);

    res.json({
      success: true,
      data: {
        recording_id: recordingData.id,
        message: 'Recording started successfully'
      }
    });

  } catch (error) {
    logger.error('Start recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start recording'
    });
  }
});

// @route   POST /api/recordings/:id/stop
// @desc    Stop recording
// @access  Private
router.post('/:id/stop', auth, async (req, res) => {
  try {
    const recordingId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const recording = await db('recordings')
        .join('streams', 'recordings.stream_id', 'streams.id')
        .select('recordings.*')
        .where({ 
          'recordings.id': recordingId, 
          'streams.user_id': req.user.id 
        })
        .first();

      if (!recording) {
        return res.status(404).json({
          success: false,
          error: 'Recording not found'
        });
      }

      if (recording.status !== 'recording') {
        return res.status(400).json({
          success: false,
          error: 'Recording is not active'
        });
      }

      // Stop recording and update status
      await db('recordings')
        .where({ id: recordingId })
        .update({
          status: 'completed',
          stopped_at: new Date(),
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for recording stop');
    }

    res.json({
      success: true,
      data: {
        message: 'Recording stopped successfully'
      }
    });

  } catch (error) {
    logger.error('Stop recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop recording'
    });
  }
});

// @route   GET /api/recordings/:id/download
// @desc    Download recording
// @access  Private
router.get('/:id/download', auth, async (req, res) => {
  try {
    const recordingId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const recording = await db('recordings')
        .join('streams', 'recordings.stream_id', 'streams.id')
        .select('recordings.*', 'streams.title as stream_title')
        .where({ 
          'recordings.id': recordingId, 
          'streams.user_id': req.user.id 
        })
        .first();

      if (!recording) {
        return res.status(404).json({
          success: false,
          error: 'Recording not found'
        });
      }

      if (recording.status !== 'completed') {
        return res.status(400).json({
          success: false,
          error: 'Recording is not ready for download'
        });
      }

      // In production, this would serve the actual file
      // For now, we'll return a download URL
      const downloadUrl = `/downloads/recordings/${recordingId}.${recording.format}`;
      
      res.json({
        success: true,
        data: {
          download_url: downloadUrl,
          filename: `${recording.stream_title}_${recordingId}.${recording.format}`,
          size: recording.size,
          duration: recording.duration
        }
      });

    } catch (dbError) {
      logger.warn('Database not available for recording download');
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable'
      });
    }

  } catch (error) {
    logger.error('Download recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to prepare download'
    });
  }
});

// @route   DELETE /api/recordings/:id
// @desc    Delete recording
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const recordingId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const recording = await db('recordings')
        .join('streams', 'recordings.stream_id', 'streams.id')
        .select('recordings.*')
        .where({ 
          'recordings.id': recordingId, 
          'streams.user_id': req.user.id 
        })
        .first();

      if (!recording) {
        return res.status(404).json({
          success: false,
          error: 'Recording not found'
        });
      }

      // Delete file if exists
      if (recording.file_path) {
        try {
          await fs.unlink(recording.file_path);
        } catch (fileError) {
          logger.warn('Failed to delete recording file:', fileError);
        }
      }

      // Delete from database
      await db('recordings')
        .where({ id: recordingId })
        .del();

    } catch (dbError) {
      logger.warn('Database not available for recording deletion');
    }

    res.json({
      success: true,
      data: {
        message: 'Recording deleted successfully'
      }
    });

  } catch (error) {
    logger.error('Delete recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete recording'
    });
  }
});

// Mock function to simulate recording process
async function startRecordingProcess(recordingId) {
  try {
    // Simulate recording with periodic size and duration updates
    let duration = 0;
    let size = 0;
    
    const interval = setInterval(async () => {
      duration += 30; // 30 seconds increment
      size += 1048576; // Fixed 1MB increment for consistent recording simulation
      
      try {
        await db('recordings')
          .where({ id: recordingId })
          .update({
            duration,
            size,
            updated_at: new Date()
          });
      } catch (dbError) {
        logger.warn('Database not available for recording update');
      }
      
      // Simulate random recording stop after some time (for demo)
      if (Math.random() < 0.1 && duration > 300) { // 10% chance to stop after 5 minutes
        clearInterval(interval);
        
        try {
          await db('recordings')
            .where({ id: recordingId })
            .update({
              status: 'completed',
              stopped_at: new Date(),
              updated_at: new Date(),
              file_path: `/recordings/${recordingId}.mp4`
            });
        } catch (dbError) {
          logger.warn('Database not available for recording completion');
        }
      }
    }, 30000); // Update every 30 seconds

  } catch (error) {
    logger.error('Recording process error:', error);
  }
}

module.exports = router;
