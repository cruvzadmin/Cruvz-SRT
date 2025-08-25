const express = require('express');
const { auth } = require('../middleware/auth');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// @route   GET /api/recordings
// @desc    Get user's recordings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      search, 
      quality, 
      date_from, 
      date_to, 
      limit = 20, 
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    let query = db('recordings')
      .join('streams', 'recordings.stream_id', 'streams.id')
      .select(
        'recordings.*',
        'streams.title as stream_title',
        'streams.protocol'
      )
      .where('streams.user_id', req.user.id)
      .orderBy(`recordings.${sort_by}`, sort_order)
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    // Apply filters
    if (search) {
      query = query.where(function() {
        this.where('recordings.title', 'like', `%${search}%`)
            .orWhere('streams.title', 'like', `%${search}%`);
      });
    }

    if (quality && quality !== 'all') {
      query = query.where('recordings.quality', quality);
    }

    if (date_from) {
      query = query.where('recordings.created_at', '>=', new Date(date_from));
    }

    if (date_to) {
      query = query.where('recordings.created_at', '<=', new Date(date_to));
    }

    const recordings = await query;

    // Get total count for pagination
    let countQuery = db('recordings')
      .join('streams', 'recordings.stream_id', 'streams.id')
      .where('streams.user_id', req.user.id);

    if (search) {
      countQuery = countQuery.where(function() {
        this.where('recordings.title', 'like', `%${search}%`)
            .orWhere('streams.title', 'like', `%${search}%`);
      });
    }

    if (quality && quality !== 'all') {
      countQuery = countQuery.where('recordings.quality', quality);
    }

    if (date_from) {
      countQuery = countQuery.where('recordings.created_at', '>=', new Date(date_from));
    }

    if (date_to) {
      countQuery = countQuery.where('recordings.created_at', '<=', new Date(date_to));
    }

    const totalCount = await countQuery.count('* as count').first();

    res.json({
      success: true,
      data: recordings,
      pagination: {
        total: totalCount.count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: totalCount.count > (parseInt(offset) + recordings.length)
      }
    });

  } catch (error) {
    logger.error('Get recordings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recordings'
    });
  }
});

// @route   GET /api/recordings/:recordingId
// @desc    Get recording details
// @access  Private
router.get('/:recordingId', auth, async (req, res) => {
  try {
    const { recordingId } = req.params;

    const recording = await db('recordings')
      .join('streams', 'recordings.stream_id', 'streams.id')
      .select(
        'recordings.*',
        'streams.title as stream_title',
        'streams.protocol',
        'streams.description as stream_description'
      )
      .where('recordings.id', recordingId)
      .where('streams.user_id', req.user.id)
      .first();

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    res.json({
      success: true,
      data: recording
    });

  } catch (error) {
    logger.error('Get recording details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recording details'
    });
  }
});

// @route   POST /api/recordings/:recordingId/download
// @desc    Generate download link for recording
// @access  Private
router.post('/:recordingId/download', auth, async (req, res) => {
  try {
    const { recordingId } = req.params;

    const recording = await db('recordings')
      .join('streams', 'recordings.stream_id', 'streams.id')
      .where('recordings.id', recordingId)
      .where('streams.user_id', req.user.id)
      .first();

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    // Generate secure download token
    const downloadToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store download token
    await db('recording_downloads').insert({
      id: downloadToken,
      recording_id: recordingId,
      user_id: req.user.id,
      expires_at: expiresAt,
      created_at: new Date()
    });

    const downloadUrl = `${req.protocol}://${req.get('host')}/api/recordings/download/${downloadToken}`;

    res.json({
      success: true,
      data: {
        download_url: downloadUrl,
        expires_at: expiresAt,
        file_size: recording.file_size,
        format: recording.format || 'mp4'
      }
    });

  } catch (error) {
    logger.error('Generate download link error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate download link'
    });
  }
});

// @route   GET /api/recordings/download/:token
// @desc    Download recording file
// @access  Public (with token)
router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const download = await db('recording_downloads')
      .join('recordings', 'recording_downloads.recording_id', 'recordings.id')
      .select('recordings.*', 'recording_downloads.expires_at')
      .where('recording_downloads.id', token)
      .where('recording_downloads.expires_at', '>', new Date())
      .first();

    if (!download) {
      return res.status(404).json({
        success: false,
        error: 'Download link not found or expired'
      });
    }

    // Check if file exists
    const filePath = download.file_path;
    if (!filePath) {
      return res.status(404).json({
        success: false,
        error: 'Recording file not found'
      });
    }

    try {
      await fs.access(filePath);
    } catch (fileError) {
      return res.status(404).json({
        success: false,
        error: 'Recording file not available'
      });
    }

    // Set appropriate headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${download.title || 'recording'}.${download.format || 'mp4'}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // In a real implementation, you would stream the file
    res.json({
      success: true,
      message: 'File download would start here',
      file_info: {
        title: download.title,
        size: download.file_size,
        format: download.format
      }
    });

  } catch (error) {
    logger.error('Download recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download recording'
    });
  }
});

// @route   DELETE /api/recordings/:recordingId
// @desc    Delete recording
// @access  Private
router.delete('/:recordingId', auth, async (req, res) => {
  try {
    const { recordingId } = req.params;

    const recording = await db('recordings')
      .join('streams', 'recordings.stream_id', 'streams.id')
      .where('recordings.id', recordingId)
      .where('streams.user_id', req.user.id)
      .first();

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    // Delete from database
    await db('recordings').where('id', recordingId).del();

    // Delete download tokens
    await db('recording_downloads').where('recording_id', recordingId).del();

    // In a real implementation, you would also delete the actual file
    if (recording.file_path) {
      try {
        await fs.unlink(recording.file_path);
      } catch (fileError) {
        logger.warn(`Failed to delete recording file: ${recording.file_path}`);
      }
    }

    logger.info(`Recording deleted: ${recordingId} by user ${req.user.id}`);

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

// @route   POST /api/recordings/:recordingId/share
// @desc    Generate shareable link for recording
// @access  Private
router.post('/:recordingId/share', auth, async (req, res) => {
  try {
    const { recordingId } = req.params;
    const { expires_hours = 24, password = null } = req.body;

    const recording = await db('recordings')
      .join('streams', 'recordings.stream_id', 'streams.id')
      .where('recordings.id', recordingId)
      .where('streams.user_id', req.user.id)
      .first();

    if (!recording) {
      return res.status(404).json({
        success: false,
        error: 'Recording not found'
      });
    }

    const shareToken = uuidv4();
    const expiresAt = new Date(Date.now() + expires_hours * 60 * 60 * 1000);

    await db('recording_shares').insert({
      id: shareToken,
      recording_id: recordingId,
      user_id: req.user.id,
      password: password,
      expires_at: expiresAt,
      created_at: new Date()
    });

    const shareUrl = `${req.protocol}://${req.get('host')}/recordings/view/${shareToken}`;

    res.json({
      success: true,
      data: {
        share_url: shareUrl,
        share_token: shareToken,
        expires_at: expiresAt,
        password_protected: !!password
      }
    });

  } catch (error) {
    logger.error('Share recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create share link'
    });
  }
});

// @route   POST /api/recordings/upload
// @desc    Upload recording file
// @access  Private
router.post('/upload', auth, async (req, res) => {
  try {
    const { title, description, stream_id, quality = '1080p' } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required'
      });
    }

    // If stream_id is provided, verify ownership
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

    const recordingData = {
      id: uuidv4(),
      title,
      description: description || '',
      stream_id: stream_id || null,
      user_id: req.user.id,
      quality,
      format: 'mp4',
      duration: 0, // Will be updated after processing
      file_size: 0, // Will be updated after upload
      file_path: null, // Will be set after upload
      status: 'uploading',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('recordings').insert(recordingData);

    // In a real implementation, you would handle the actual file upload here
    // For now, we'll simulate the upload process
    setTimeout(async () => {
      try {
        await db('recordings')
          .where('id', recordingData.id)
          .update({
            status: 'completed',
            file_size: Math.floor(Math.random() * 1000000000) + 100000000, // Random file size
            duration: Math.floor(Math.random() * 3600) + 300, // Random duration
            file_path: `/recordings/${recordingData.id}.mp4`,
            updated_at: new Date()
          });
      } catch (error) {
        logger.error('Error updating uploaded recording:', error);
      }
    }, 3000);

    res.json({
      success: true,
      data: {
        recording_id: recordingData.id,
        message: 'Upload started successfully',
        upload_url: `/api/recordings/${recordingData.id}/upload-file` // In real implementation
      }
    });

  } catch (error) {
    logger.error('Upload recording error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate recording upload'
    });
  }
});

// @route   GET /api/recordings/stats
// @desc    Get recording statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    let timeFilter;
    switch (timeframe) {
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

    // Get overall statistics
    const overallStats = await db('recordings')
      .join('streams', 'recordings.stream_id', 'streams.id')
      .where('streams.user_id', req.user.id)
      .where('recordings.created_at', '>=', timeFilter)
      .select(
        db.raw('COUNT(*) as total_recordings'),
        db.raw('SUM(recordings.file_size) as total_size'),
        db.raw('SUM(recordings.duration) as total_duration'),
        db.raw('AVG(recordings.duration) as avg_duration')
      )
      .first();

    // Get recordings by quality
    const qualityStats = await db('recordings')
      .join('streams', 'recordings.stream_id', 'streams.id')
      .where('streams.user_id', req.user.id)
      .where('recordings.created_at', '>=', timeFilter)
      .groupBy('recordings.quality')
      .select(
        'recordings.quality',
        db.raw('COUNT(*) as count'),
        db.raw('SUM(recordings.file_size) as total_size')
      );

    // Get daily recording counts
    const dailyStats = await db('recordings')
      .join('streams', 'recordings.stream_id', 'streams.id')
      .where('streams.user_id', req.user.id)
      .where('recordings.created_at', '>=', timeFilter)
      .groupBy(db.raw('DATE(recordings.created_at)'))
      .select(
        db.raw('DATE(recordings.created_at) as date'),
        db.raw('COUNT(*) as count'),
        db.raw('SUM(recordings.duration) as total_duration')
      )
      .orderBy('date', 'asc');

    res.json({
      success: true,
      data: {
        timeframe,
        overview: {
          total_recordings: parseInt(overallStats.total_recordings) || 0,
          total_size_bytes: parseInt(overallStats.total_size) || 0,
          total_size_gb: ((overallStats.total_size || 0) / (1024 * 1024 * 1024)).toFixed(2),
          total_duration_seconds: parseInt(overallStats.total_duration) || 0,
          total_duration_hours: ((overallStats.total_duration || 0) / 3600).toFixed(2),
          average_duration_minutes: ((overallStats.avg_duration || 0) / 60).toFixed(2)
        },
        by_quality: qualityStats,
        daily_trend: dailyStats,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Recording stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recording statistics'
    });
  }
});

module.exports = router;