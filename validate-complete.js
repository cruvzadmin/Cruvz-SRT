#!/usr/bin/env node

// Comprehensive Production Validation Test
const axios = require('axios');

const API_BASE = 'http://localhost:5000';
const ORIGIN_BASE = 'http://localhost:8080';
const WEB_BASE = 'http://localhost:80';

async function validateProduction() {
  console.log('🚀 CRUVZ STREAMING - PRODUCTION VALIDATION');
  console.log('==========================================\n');

  const results = {
    backend: false,
    streaming: false,
    webApp: false,
    userWorkflows: false,
    streamingProtocols: false,
    analytics: false
  };

  try {
    // 1. Backend Health Check
    console.log('1️⃣ Testing Backend Health...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    if (healthResponse.data.status === 'healthy') {
      results.backend = true;
      console.log('✅ Backend: HEALTHY');
      console.log(`   Database: ${healthResponse.data.database.type}`);
      console.log(`   Uptime: ${Math.floor(healthResponse.data.uptime)}s`);
    } else {
      throw new Error('Backend not healthy');
    }

    // 2. Streaming Engine Health Check
    console.log('\n2️⃣ Testing Streaming Engine...');
    const originResponse = await axios.get(`${ORIGIN_BASE}/v1/stats/current`);
    if (originResponse.data.status === 'healthy') {
      results.streaming = true;
      console.log('✅ OvenMediaEngine: HEALTHY');
    } else {
      throw new Error('Streaming engine not healthy');
    }

    // 3. Web Application
    console.log('\n3️⃣ Testing Web Application...');
    const webResponse = await axios.get(WEB_BASE);
    if (webResponse.data.includes('Cruvz Streaming')) {
      results.webApp = true;
      console.log('✅ Web Application: ACCESSIBLE');
    } else {
      throw new Error('Web application not accessible');
    }

    // 4. User Registration and Authentication
    console.log('\n4️⃣ Testing User Workflows...');
    const timestamp = Date.now();
    const testUser = {
      firstName: 'Test',
      lastName: 'User',
      email: `test${timestamp}@example.com`,
      password: 'TestPass123!'
    };

    // Register user
    const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, testUser);
    if (!registerResponse.data.success) {
      throw new Error('User registration failed');
    }
    
    const authToken = registerResponse.data.data.token;
    console.log('✅ User Registration: SUCCESS');

    // Login user
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    if (!loginResponse.data.success) {
      throw new Error('User login failed');
    }
    console.log('✅ User Authentication: SUCCESS');

    // Create and manage stream
    const streamData = {
      title: 'Production Test Stream',
      description: 'Testing streaming functionality',
      protocol: 'rtmp'
    };

    const createStreamResponse = await axios.post(
      `${API_BASE}/api/streams`,
      streamData,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    if (!createStreamResponse.data.success) {
      throw new Error('Stream creation failed');
    }
    
    const streamId = createStreamResponse.data.data.id;
    console.log('✅ Stream Creation: SUCCESS');

    // Start stream
    const startStreamResponse = await axios.post(
      `${API_BASE}/api/streams/${streamId}/start`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    if (!startStreamResponse.data.success) {
      throw new Error('Stream start failed');
    }
    
    results.userWorkflows = true;
    console.log('✅ Stream Management: SUCCESS');

    // 5. Streaming Protocol URLs
    console.log('\n5️⃣ Testing Streaming Protocol URLs...');
    const streamUrls = startStreamResponse.data.data.streaming_urls;
    
    console.log(`📡 RTMP URL: ${streamUrls.rtmp}`);
    console.log(`🌐 WebRTC URL: ${streamUrls.webrtc}`);
    console.log(`📺 SRT URL: ${streamUrls.srt}`);
    
    // Validate URL formats
    if (streamUrls.rtmp.includes('rtmp://') && 
        streamUrls.webrtc.includes('http://') && 
        streamUrls.srt.includes('srt://')) {
      results.streamingProtocols = true;
      console.log('✅ Streaming Protocols: URLs GENERATED');
    } else {
      throw new Error('Invalid streaming URLs');
    }

    // 6. Analytics
    console.log('\n6️⃣ Testing Analytics...');
    const analyticsResponse = await axios.get(
      `${API_BASE}/api/analytics/dashboard`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    if (analyticsResponse.data.success && analyticsResponse.data.data.dashboard) {
      results.analytics = true;
      console.log('✅ Analytics: FUNCTIONAL');
      console.log(`   Total Streams: ${analyticsResponse.data.data.dashboard.total_streams}`);
      console.log(`   Active Streams: ${analyticsResponse.data.data.dashboard.active_streams}`);
    } else {
      throw new Error('Analytics not working');
    }

    // Stop stream
    await axios.post(
      `${API_BASE}/api/streams/${streamId}/stop`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }

  // Final Summary
  console.log('\n🎯 PRODUCTION VALIDATION SUMMARY');
  console.log('=================================');
  
  const checks = [
    ['Backend API', results.backend],
    ['Streaming Engine', results.streaming],
    ['Web Application', results.webApp],
    ['User Workflows', results.userWorkflows],
    ['Streaming Protocols', results.streamingProtocols],
    ['Analytics & Monitoring', results.analytics]
  ];

  let passed = 0;
  checks.forEach(([name, status]) => {
    console.log(`${status ? '✅' : '❌'} ${name}: ${status ? 'PASS' : 'FAIL'}`);
    if (status) passed++;
  });

  const score = Math.round((passed / checks.length) * 100);
  console.log(`\n📊 Production Readiness Score: ${score}%`);
  
  if (score === 100) {
    console.log('\n🎉 SYSTEM IS 100% PRODUCTION READY!');
    console.log('🚀 All core features are working correctly');
    console.log('🔥 Ready for real user deployment');
  } else {
    console.log(`\n⚠️  System needs attention (${100 - score}% of checks failed)`);
  }

  console.log('\n🌐 PRODUCTION ENDPOINTS:');
  console.log('========================');
  console.log('Main Website:     http://localhost');
  console.log('Backend API:      http://localhost:5000');
  console.log('Health Check:     http://localhost:5000/health');
  console.log('Streaming Engine: http://localhost:8080');
  console.log('\n📡 STREAMING PROTOCOLS READY:');
  console.log('=============================');
  console.log('RTMP:    rtmp://localhost:1935/app/stream_name');
  console.log('WebRTC:  http://localhost:3333/app/stream_name');
  console.log('SRT:     srt://localhost:9999?streamid=app/stream_name');

  process.exit(score === 100 ? 0 : 1);
}

// Wait for services to be ready
async function waitForServices() {
  console.log('⏳ Waiting for services to be ready...');
  
  for (let i = 0; i < 30; i++) {
    try {
      await axios.get(`${API_BASE}/health`, { timeout: 5000 });
      console.log('✅ Services are ready!\n');
      return;
    } catch (error) {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('Services did not become ready in time');
}

// Main execution
(async () => {
  try {
    await waitForServices();
    await validateProduction();
  } catch (error) {
    console.error(`\n❌ Validation failed: ${error.message}`);
    process.exit(1);
  }
})();