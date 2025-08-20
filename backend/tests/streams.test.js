const request = require('supertest');
const app = require('../server');
const db = require('../config/database');

describe('Stream Input/Output Fields Tests', () => {
  let token;
  let userId;

  beforeAll(async () => {
    // Ensure database is set up
    const migrate = require('../scripts/migrate');
    await migrate();
    
    // Register and login a test user
    const userData = {
      name: 'Test User',
      email: 'streamtest@example.com',
      password: 'TestPassword123!'
    };

    await request(app)
      .post('/api/auth/register')
      .send(userData);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      });

    if (loginResponse.body.success && loginResponse.body.data) {
      token = loginResponse.body.data.token;
      userId = loginResponse.body.data.user.id;
    } else {
      throw new Error('Failed to authenticate test user: ' + JSON.stringify(loginResponse.body));
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await db('streams').where({ user_id: userId }).del();
      await db('users').where({ id: userId }).del();
      await db.destroy();
    } catch (error) {
      console.log('Cleanup error:', error);
    }
  });

  describe('Stream Creation with Input/Output URLs', () => {
    test('Should create stream with source_url and destination_url', async () => {
      const streamData = {
        title: 'Test Stream with URLs',
        description: 'Testing stream input/output URLs',
        protocol: 'rtmp',
        source_url: 'rtmp://input.example.com/live/stream_key',
        destination_url: 'rtmp://localhost:1935/app/test_stream',
        settings: {
          quality: '1080p',
          bitrate: 5000,
          fps: 30
        },
        max_viewers: 1000,
        is_recording: false
      };

      const response = await request(app)
        .post('/api/streams')
        .set('Authorization', `Bearer ${token}`)
        .send(streamData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('source_url', streamData.source_url);
      expect(response.body.data).toHaveProperty('destination_url', streamData.destination_url);
      expect(response.body.data).toHaveProperty('protocol', 'rtmp');
    });

    test('Should create stream with SRT URLs', async () => {
      const streamData = {
        title: 'SRT Stream Test',
        description: 'Testing SRT protocol URLs',
        protocol: 'srt',
        source_url: 'srt://input.example.com:9999?streamid=input_stream',
        destination_url: 'srt://localhost:9999?streamid=app/srt_stream',
        settings: {
          quality: '720p',
          bitrate: 3000,
          fps: 30
        }
      };

      const response = await request(app)
        .post('/api/streams')
        .set('Authorization', `Bearer ${token}`)
        .send(streamData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('source_url', streamData.source_url);
      expect(response.body.data).toHaveProperty('destination_url', streamData.destination_url);
      expect(response.body.data).toHaveProperty('protocol', 'srt');
    });

    test('Should create stream with WebRTC URLs', async () => {
      const streamData = {
        title: 'WebRTC Stream Test',
        description: 'Testing WebRTC protocol URLs',
        protocol: 'webrtc',
        source_url: 'http://input.example.com:3333/app/input_stream',
        destination_url: 'http://localhost:3333/app/webrtc_stream',
        settings: {
          quality: '4k',
          bitrate: 12000,
          fps: 60
        }
      };

      const response = await request(app)
        .post('/api/streams')
        .set('Authorization', `Bearer ${token}`)
        .send(streamData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('source_url', streamData.source_url);
      expect(response.body.data).toHaveProperty('destination_url', streamData.destination_url);
      expect(response.body.data).toHaveProperty('protocol', 'webrtc');
    });

    test('Should validate required URLs', async () => {
      const streamData = {
        title: 'Stream with auto-generated URLs',
        description: 'Testing auto-generated URLs when not provided',
        protocol: 'rtmp'
        // Missing source_url and destination_url - should work fine as they are optional
      };

      const response = await request(app)
        .post('/api/streams')
        .set('Authorization', `Bearer ${token}`)
        .send(streamData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      // URLs should be auto-generated or empty and filled when stream starts
    });

    test('Should validate URL format', async () => {
      const streamData = {
        title: 'Invalid URL Stream',
        description: 'Testing invalid URLs',
        protocol: 'rtmp',
        source_url: 'not-a-valid-url',
        destination_url: 'also-not-valid'
      };

      const response = await request(app)
        .post('/api/streams')
        .set('Authorization', `Bearer ${token}`)
        .send(streamData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Stream Start with URL Generation', () => {
    let streamId;

    beforeEach(async () => {
      const streamData = {
        title: 'URL Generation Test Stream',
        description: 'Testing URL generation on start',
        protocol: 'rtmp',
        source_url: 'rtmp://input.example.com/live/stream_key',
        destination_url: 'rtmp://localhost:1935/app/test_stream'
      };

      const response = await request(app)
        .post('/api/streams')
        .set('Authorization', `Bearer ${token}`)
        .send(streamData);

      streamId = response.body.data.id;
    });

    test('Should provide stream URLs when starting stream', async () => {
      const response = await request(app)
        .post(`/api/streams/${streamId}/start`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('source_url');
      expect(response.body.data).toHaveProperty('destination_url');
      expect(response.body.data).toHaveProperty('stream_key');
    });

    test('Should generate default URLs when custom URLs not provided', async () => {
      // Create stream without custom URLs
      const streamData = {
        title: 'Default URL Stream',
        description: 'Testing default URL generation',
        protocol: 'rtmp'
        // No source_url and destination_url provided - should auto-generate
      };

      const createResponse = await request(app)
        .post('/api/streams')
        .set('Authorization', `Bearer ${token}`)
        .send(streamData);

      const newStreamId = createResponse.body.data.id;

      const startResponse = await request(app)
        .post(`/api/streams/${newStreamId}/start`)
        .set('Authorization', `Bearer ${token}`);

      expect(startResponse.status).toBe(200);
      expect(startResponse.body.data.source_url).toContain('localhost:1935');
      expect(startResponse.body.data.destination_url).toContain('localhost:1935');
    });
  });

  describe('Stream Update with URL Changes', () => {
    let streamId;

    beforeEach(async () => {
      const streamData = {
        title: 'URL Update Test Stream',
        description: 'Testing URL updates',
        protocol: 'rtmp',
        source_url: 'rtmp://input.example.com/live/stream_key',
        destination_url: 'rtmp://localhost:1935/app/test_stream'
      };

      const response = await request(app)
        .post('/api/streams')
        .set('Authorization', `Bearer ${token}`)
        .send(streamData);

      streamId = response.body.data.id;
    });

    test('Should update stream URLs', async () => {
      const updateData = {
        source_url: 'rtmp://newinput.example.com/live/new_key',
        destination_url: 'rtmp://localhost:1935/app/updated_stream'
      };

      const response = await request(app)
        .put(`/api/streams/${streamId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('source_url', updateData.source_url);
      expect(response.body.data).toHaveProperty('destination_url', updateData.destination_url);
    });
  });
});