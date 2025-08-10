const request = require('supertest');
const app = require('../server');

describe('Health Check Endpoint', () => {
  test('GET /health should return healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('version', '2.0.0');
    expect(response.body).toHaveProperty('environment');
  });
});

describe('Authentication Endpoints', () => {
  test('POST /api/auth/register should validate input', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'invalid-email',
        password: 'weak'
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('POST /api/auth/login should validate input', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'invalid-email',
        password: ''
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });
});

describe('Protected Endpoints', () => {
  test('GET /api/streams should require authentication', async () => {
    const response = await request(app)
      .get('/api/streams')
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });

  test('GET /api/users/profile should require authentication', async () => {
    const response = await request(app)
      .get('/api/users/profile')
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });

  test('GET /api/analytics/dashboard should require authentication', async () => {
    const response = await request(app)
      .get('/api/analytics/dashboard')
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });
});

describe('Static File Serving', () => {
  test('GET / should serve frontend or fallback', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);

    // Should either serve frontend HTML or fallback message
    expect(response.text).toBeDefined();
  });
});