const express = require('express');
const { auth } = require('../middleware/auth');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'development']);
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// @route   GET /api/transcoding/profiles
// @desc    Get transcoding profiles
// @access  Private
router.get('/profiles', auth, async (req, res) => {
  try {
    let profiles = [];
    
    try {
      profiles = await db('transcoding_profiles')
        .where({ user_id: req.user.id })
        .orderBy('created_at', 'desc');
    } catch (dbError) {
      logger.warn('Database not available for transcoding profiles');
      // Return default profiles
      profiles = getDefaultTranscodingProfiles(req.user.id);
    }

    res.json({
      success: true,
      data: profiles
    });

  } catch (error) {
    logger.error('Transcoding profiles error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transcoding profiles'
    });
  }
});

// @route   POST /api/transcoding/profiles
// @desc    Create transcoding profile
// @access  Private
router.post('/profiles', auth, async (req, res) => {
  try {
    const {
      name,
      description,
      resolutions,
      bitrates,
      codec,
      audio_codec,
      audio_bitrate,
      fps,
      keyframe_interval,
      preset
    } = req.body;

    // Validate required fields
    if (!name || !resolutions || !bitrates) {
      return res.status(400).json({
        success: false,
        error: 'Name, resolutions, and bitrates are required'
      });
    }

    const profileData = {
      id: uuidv4(),
      user_id: req.user.id,
      name,
      description: description || '',
      configuration: JSON.stringify({
        resolutions: resolutions || ['1080p', '720p', '480p'],
        bitrates: bitrates || [5000, 3000, 1500],
        codec: codec || 'h264',
        audio_codec: audio_codec || 'aac',
        audio_bitrate: audio_bitrate || 128,
        fps: fps || 30,
        keyframe_interval: keyframe_interval || 60,
        preset: preset || 'medium'
      }),
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('transcoding_profiles').insert(profileData);

    logger.info(`Transcoding profile created: ${name} for user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        id: profileData.id,
        message: 'Transcoding profile created successfully',
        profile: profileData
      }
    });

  } catch (error) {
    logger.error('Create transcoding profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create transcoding profile'
    });
  }
});

// @route   PUT /api/transcoding/profiles/:profileId
// @desc    Update transcoding profile
// @access  Private
router.put('/profiles/:profileId', auth, async (req, res) => {
  try {
    const { profileId } = req.params;
    const updates = req.body;

    // Check if profile exists and belongs to user
    const profile = await db('transcoding_profiles')
      .where({ id: profileId, user_id: req.user.id })
      .first();

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Transcoding profile not found'
      });
    }

    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    // If configuration is being updated, stringify it
    if (updates.configuration) {
      updateData.configuration = JSON.stringify(updates.configuration);
    }

    await db('transcoding_profiles')
      .where({ id: profileId, user_id: req.user.id })
      .update(updateData);

    logger.info(`Transcoding profile updated: ${profileId} for user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        message: 'Transcoding profile updated successfully',
        profile_id: profileId
      }
    });

  } catch (error) {
    logger.error('Update transcoding profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update transcoding profile'
    });
  }
});

// @route   DELETE /api/transcoding/profiles/:profileId
// @desc    Delete transcoding profile
// @access  Private
router.delete('/profiles/:profileId', auth, async (req, res) => {
  try {
    const { profileId } = req.params;

    // Check if profile exists and belongs to user
    const profile = await db('transcoding_profiles')
      .where({ id: profileId, user_id: req.user.id })
      .first();

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Transcoding profile not found'
      });
    }

    // Check if profile is being used by any active jobs
    const activeJobs = await db('transcoding_jobs')
      .where({ profile_id: profileId, status: 'running' })
      .count('* as count')
      .first();

    if (activeJobs.count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete profile with active transcoding jobs'
      });
    }

    await db('transcoding_profiles')
      .where({ id: profileId, user_id: req.user.id })
      .del();

    logger.info(`Transcoding profile deleted: ${profileId} for user ${req.user.id}`);

    res.json({
      success: true,
      data: {
        message: 'Transcoding profile deleted successfully'
      }
    });

  } catch (error) {
    logger.error('Delete transcoding profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete transcoding profile'
    });
  }
});

// @route   GET /api/transcoding/jobs
// @desc    Get transcoding jobs
// @access  Private
router.get('/jobs', auth, async (req, res) => {
  try {
    const { status, limit = 20 } = req.query;
    
    let query = db('transcoding_jobs')
      .join('streams', 'transcoding_jobs.stream_id', 'streams.id')
      .join('transcoding_profiles', 'transcoding_jobs.profile_id', 'transcoding_profiles.id')
      .select(
        'transcoding_jobs.*',
        'streams.title as stream_title',
        'transcoding_profiles.name as profile_name'
      )
      .where('streams.user_id', req.user.id)
      .orderBy('transcoding_jobs.created_at', 'desc')
      .limit(parseInt(limit));

    if (status) {
      query = query.where('transcoding_jobs.status', status);
    }

    const jobs = await query;

    res.json({
      success: true,
      data: jobs
    });

  } catch (error) {
    logger.error('Transcoding jobs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transcoding jobs'
    });
  }
});

// @route   POST /api/transcoding/jobs
// @desc    Start transcoding job
// @access  Private
router.post('/jobs', auth, async (req, res) => {
  try {
    const { stream_id, profile_id, priority = 'normal' } = req.body;

    if (!stream_id || !profile_id) {
      return res.status(400).json({
        success: false,
        error: 'Stream ID and profile ID are required'
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

    // Verify profile ownership
    const profile = await db('transcoding_profiles')
      .where({ id: profile_id, user_id: req.user.id })
      .first();

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Transcoding profile not found'
      });
    }

    const jobData = {
      id: uuidv4(),
      stream_id,
      profile_id,
      status: 'queued',
      priority,
      progress: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db('transcoding_jobs').insert(jobData);

    // In a real implementation, this would trigger the actual transcoding process
    // For now, we'll simulate it starting
    setTimeout(async () => {
      try {
        await db('transcoding_jobs')
          .where({ id: jobData.id })
          .update({ 
            status: 'running', 
            started_at: new Date(),
            updated_at: new Date()
          });
        
        // Simulate progress updates
        simulateTranscodingProgress(jobData.id);
      } catch (error) {
        logger.error('Error starting transcoding job:', error);
      }
    }, 1000);

    logger.info(`Transcoding job started: ${jobData.id} for stream ${stream_id}`);

    res.json({
      success: true,
      data: {
        job_id: jobData.id,
        message: 'Transcoding job started successfully',
        job: jobData
      }
    });

  } catch (error) {
    logger.error('Start transcoding job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start transcoding job'
    });
  }
});

// @route   POST /api/transcoding/jobs/:jobId/cancel
// @desc    Cancel transcoding job
// @access  Private
router.post('/jobs/:jobId/cancel', auth, async (req, res) => {
  try {
    const { jobId } = req.params;

    // Verify job ownership through stream
    const job = await db('transcoding_jobs')
      .join('streams', 'transcoding_jobs.stream_id', 'streams.id')
      .where('transcoding_jobs.id', jobId)
      .where('streams.user_id', req.user.id)
      .first();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Transcoding job not found'
      });
    }

    if (job.status === 'completed' || job.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel a completed or already cancelled job'
      });
    }

    await db('transcoding_jobs')
      .where({ id: jobId })
      .update({
        status: 'cancelled',
        cancelled_at: new Date(),
        updated_at: new Date()
      });

    logger.info(`Transcoding job cancelled: ${jobId}`);

    res.json({
      success: true,
      data: {
        message: 'Transcoding job cancelled successfully',
        job_id: jobId
      }
    });

  } catch (error) {
    logger.error('Cancel transcoding job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel transcoding job'
    });
  }
});

// @route   GET /api/transcoding/jobs/:jobId
// @desc    Get transcoding job details
// @access  Private
router.get('/jobs/:jobId', auth, async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await db('transcoding_jobs')
      .join('streams', 'transcoding_jobs.stream_id', 'streams.id')
      .join('transcoding_profiles', 'transcoding_jobs.profile_id', 'transcoding_profiles.id')
      .select(
        'transcoding_jobs.*',
        'streams.title as stream_title',
        'transcoding_profiles.name as profile_name',
        'transcoding_profiles.configuration as profile_config'
      )
      .where('transcoding_jobs.id', jobId)
      .where('streams.user_id', req.user.id)
      .first();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Transcoding job not found'
      });
    }

    // Parse configuration
    if (job.profile_config) {
      try {
        job.profile_configuration = JSON.parse(job.profile_config);
        delete job.profile_config;
      } catch (parseError) {
        logger.warn('Failed to parse profile configuration');
      }
    }

    res.json({
      success: true,
      data: job
    });

  } catch (error) {
    logger.error('Get transcoding job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transcoding job details'
    });
  }
});

// @route   GET /api/transcoding/stats
// @desc    Get transcoding statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
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

    // Get statistics for user's transcoding jobs
    const stats = await db('transcoding_jobs')
      .join('streams', 'transcoding_jobs.stream_id', 'streams.id')
      .where('streams.user_id', req.user.id)
      .where('transcoding_jobs.created_at', '>=', timeFilter)
      .select(
        db.raw('COUNT(*) as total_jobs'),
        db.raw('COUNT(CASE WHEN transcoding_jobs.status = "completed" THEN 1 END) as completed_jobs'),
        db.raw('COUNT(CASE WHEN transcoding_jobs.status = "running" THEN 1 END) as running_jobs'),
        db.raw('COUNT(CASE WHEN transcoding_jobs.status = "failed" THEN 1 END) as failed_jobs'),
        db.raw('AVG(CASE WHEN transcoding_jobs.status = "completed" THEN transcoding_jobs.duration_seconds END) as avg_duration')
      )
      .first();

    // Get jobs by profile
    const jobsByProfile = await db('transcoding_jobs')
      .join('streams', 'transcoding_jobs.stream_id', 'streams.id')
      .join('transcoding_profiles', 'transcoding_jobs.profile_id', 'transcoding_profiles.id')
      .where('streams.user_id', req.user.id)
      .where('transcoding_jobs.created_at', '>=', timeFilter)
      .groupBy('transcoding_profiles.name')
      .select(
        'transcoding_profiles.name as profile_name',
        db.raw('COUNT(*) as job_count')
      );

    res.json({
      success: true,
      data: {
        timeframe,
        overview: {
          total_jobs: parseInt(stats.total_jobs) || 0,
          completed_jobs: parseInt(stats.completed_jobs) || 0,
          running_jobs: parseInt(stats.running_jobs) || 0,
          failed_jobs: parseInt(stats.failed_jobs) || 0,
          success_rate: stats.total_jobs > 0 ? 
            ((stats.completed_jobs / stats.total_jobs) * 100).toFixed(2) : 0,
          average_duration: stats.avg_duration ? Math.round(stats.avg_duration) : 0
        },
        jobs_by_profile: jobsByProfile,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Transcoding stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transcoding statistics'
    });
  }
});

// Helper functions
function getDefaultTranscodingProfiles(userId) {
  return [
    {
      id: 'mobile-default',
      user_id: userId,
      name: 'Mobile Optimized',
      description: 'Optimized for mobile devices',
      configuration: JSON.stringify({
        resolutions: ['720p', '480p', '360p'],
        bitrates: [2500, 1500, 800],
        codec: 'h264',
        audio_codec: 'aac',
        audio_bitrate: 128,
        fps: 30,
        preset: 'fast'
      }),
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'desktop-default',
      user_id: userId,
      name: 'Desktop Quality',
      description: 'High quality for desktop viewing',
      configuration: JSON.stringify({
        resolutions: ['1080p', '720p', '480p'],
        bitrates: [5000, 3000, 1500],
        codec: 'h264',
        audio_codec: 'aac',
        audio_bitrate: 192,
        fps: 30,
        preset: 'medium'
      }),
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 'gaming-default',
      user_id: userId,
      name: 'Gaming Stream',
      description: 'High frame rate for gaming',
      configuration: JSON.stringify({
        resolutions: ['1080p60', '720p60'],
        bitrates: [8000, 5000],
        codec: 'h264',
        audio_codec: 'aac',
        audio_bitrate: 256,
        fps: 60,
        preset: 'fast'
      }),
      status: 'active',
      created_at: new Date(),
      updated_at: new Date()
    }
  ];
}

// Simulate transcoding progress (for demo purposes)
function simulateTranscodingProgress(jobId) {
  let progress = 0;
  const interval = setInterval(async () => {
    progress += Math.random() * 20; // Random progress increment
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      
      try {
        await db('transcoding_jobs')
          .where({ id: jobId })
          .update({
            status: 'completed',
            progress: 100,
            completed_at: new Date(),
            updated_at: new Date(),
            duration_seconds: Math.floor(Math.random() * 300) + 60 // Random duration
          });
      } catch (error) {
        logger.error('Error completing transcoding job:', error);
      }
    } else {
      try {
        await db('transcoding_jobs')
          .where({ id: jobId })
          .update({
            progress: Math.floor(progress),
            updated_at: new Date()
          });
      } catch (error) {
        logger.error('Error updating transcoding progress:', error);
      }
    }
  }, 2000); // Update every 2 seconds
}

module.exports = router;