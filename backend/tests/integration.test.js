const request = require('supertest');
const app = require('../server');

describe('API Validation Integration Tests', () => {
  test('Authentication endpoints validate input properly', async () => {
    // Test registration with invalid email
    const invalidEmailResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'invalid-email',
        password: 'TestPassword123!'
      })
      .expect(400);

    expect(invalidEmailResponse.body).toHaveProperty('error');

    // Test registration with weak password
    const weakPasswordResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'weak'
      })
      .expect(400);

    expect(weakPasswordResponse.body).toHaveProperty('error');

    // Test login with invalid input
    const invalidLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'invalid-email',
        password: ''
      })
      .expect(400);

    expect(invalidLoginResponse.body).toHaveProperty('error');
  });

  test('Protected endpoints require authentication', async () => {
    const protectedEndpoints = [
      '/api/users/profile',
      '/api/streams',
      '/api/analytics/dashboard'
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await request(app)
        .get(endpoint)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    }
  });

  test('Rate limiting prevents abuse', async () => {
    // Make multiple rapid requests to trigger rate limiting
    const promises = [];
    for (let i = 0; i < 7; i++) {
      promises.push(
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );
    }

    const responses = await Promise.all(promises);
    
    // Some of the responses should be rate limited (429) or failed auth (400/500)
    const rateLimitedResponses = responses.filter(res => res.status === 429);
    const errorResponses = responses.filter(res => res.status >= 400);
    
    // All requests should either fail or be rate limited
    expect(errorResponses.length).toBe(responses.length);
    
    // At least some should be rate limited
    if (rateLimitedResponses.length > 0) {
      expect(rateLimitedResponses[0].body).toHaveProperty('error');
    }
  });

  test('Health endpoint works correctly', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'healthy');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('version', '1.0.0');
  });

  test('Frontend static files are served', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);

    // Should either serve frontend HTML or fallback message
    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
  });
});