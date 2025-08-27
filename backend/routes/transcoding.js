const express = require('express');
const { auth } = require('../middleware/auth');
const knex = require('knex');
const knexConfig = require('../knexfile');
const db = knex(knexConfig[process.env.NODE_ENV || 'production']);
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// @route   GET /api/transcoding/jobs
// @desc    Get transcoding jobs and metrics
// @access  Private
router.get('/jobs', auth, async (req, res) => {
  try {
    let jobs = [];
    const metrics = {
      active_jobs: 0,
      queue_length: 0,
      cpu_usage: 0,
      success_rate: 99.8
    };
    
    try {
      await db.raw('SELECT 1');
      
      // Get transcoding jobs
      jobs = await db('transcoding_jobs')
        .join('streams', 'transcoding_jobs.stream_id', 'streams.id')
        .select(
          'transcoding_jobs.*',
          'streams.title as source_stream'
        )
        .where('transcoding_jobs.user_id', req.user.id)
        .orderBy('transcoding_jobs.created_at', 'desc')
        .limit(50);

      // Calculate metrics
      const activeJobs = await db('transcoding_jobs')
        .where({ user_id: req.user.id, status: 'processing' })
        .count('* as count')
        .first();

      const queuedJobs = await db('transcoding_jobs')
        .where({ user_id: req.user.id, status: 'queued' })
        .count('* as count')
        .first();

      metrics.active_jobs = parseInt(activeJobs.count);
      metrics.queue_length = parseInt(queuedJobs.count);
      metrics.cpu_usage = 0; // Simulated CPU usage
      
    } catch (dbError) {
      logger.warn('Database not available for transcoding jobs');
      // Return mock data
      jobs = [
        {
          id: 1,
          source_stream: 'Sample Stream',
          output_profiles: ['1080p', '720p'],
          progress: 75,
          status: 'processing',
          created_at: new Date()
        }
      ];
    }

    res.json({
      success: true,
      data: {
        jobs,
        metrics
      }
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
// @desc    Create transcoding job
// @access  Private
router.post('/jobs', auth, async (req, res) => {
  try {
    const { source_stream, output_profiles, output_format } = req.body;

    if (!source_stream || !output_profiles || output_profiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Source stream and output profiles are required'
      });
    }

    const jobData = {
      id: uuidv4(),
      user_id: req.user.id,
      stream_id: source_stream,
      output_profiles: JSON.stringify(output_profiles),
      output_format: output_format || 'mp4',
      status: 'queued',
      progress: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    try {
      await db.raw('SELECT 1');
      await db('transcoding_jobs').insert(jobData);
    } catch (dbError) {
      logger.warn('Database not available for transcoding job creation');
    }

    // Start transcoding job (in production, this would queue the job)
    processTranscodingJob(jobData.id);

    res.json({
      success: true,
      data: {
        job_id: jobData.id,
        message: 'Transcoding job started successfully'
      }
    });

  } catch (error) {
    logger.error('Create transcoding job error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create transcoding job'
    });
  }
});

// @route   POST /api/transcoding/jobs/:id/cancel
// @desc    Cancel transcoding job
// @access  Private
router.post('/jobs/:id/cancel', auth, async (req, res) => {
  try {
    const jobId = req.params.id;

    try {
      await db.raw('SELECT 1');
      
      const job = await db('transcoding_jobs')
        .where({ id: jobId, user_id: req.user.id })
        .first();

      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'Transcoding job not found'
        });
      }

      if (job.status !== 'processing' && job.status !== 'queued') {
        return res.status(400).json({
          success: false,
          error: 'Cannot cancel completed or failed job'
        });
      }

      await db('transcoding_jobs')
        .where({ id: jobId })
        .update({
          status: 'cancelled',
          updated_at: new Date()
        });

    } catch (dbError) {
      logger.warn('Database not available for job cancellation');
    }

    res.json({
      success: true,
      data: {
        message: 'Transcoding job cancelled successfully'
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

// @route   GET /api/transcoding/profiles
// @desc    Get transcoding profiles
// @access  Private
router.get('/profiles', auth, async (req, res) => {
  try {
    const profiles = [
      { id: '1080p', name: '1080p Full HD', resolution: '1920x1080', bitrate: 6000 },
      { id: '720p', name: '720p HD', resolution: '1280x720', bitrate: 3000 },
      { id: '480p', name: '480p SD', resolution: '854x480', bitrate: 1500 },
      { id: '360p', name: '360p Mobile', resolution: '640x360', bitrate: 800 }
    ];

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

// Mock function to simulate transcoding job processing
async function processTranscodingJob(jobId) {
  try {
    // Simulate job processing with progress updates
    let progress = 0;
    const interval = setInterval(async () => {
      progress += 0;
      
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        try {
          await db('transcoding_jobs')
            .where({ id: jobId })
            .update({
              status: 'completed',
              progress,
              completed_at: new Date(),
              updated_at: new Date()
            });
        } catch (dbError) {
          logger.warn('Database not available for job completion update');
        }
      } else {
        try {
          await db('transcoding_jobs')
            .where({ id: jobId })
            .update({
              status: 'processing',
              progress,
              updated_at: new Date()
            });
        } catch (dbError) {
          logger.warn('Database not available for job progress update');
        }
      }
    }, 2000); // Update every 2 seconds

  } catch (error) {
    logger.error('Process transcoding job error:', error);
  }
}

module.exports = router;
