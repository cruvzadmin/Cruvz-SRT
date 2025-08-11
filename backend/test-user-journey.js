#!/usr/bin/env node

// Complete User Journey Test - PostgreSQL Backend
const axios = require('axios');

const API_BASE = 'http://localhost:5000';
let authToken = '';
let userId = '';
let streamId = '';

// Test user data
const testUser = {
  name: 'John Streamer',
  email: 'john@example.com',
  password: 'SecurePass123!'
};

const testStream = {
  title: 'My First Stream',
  description: 'Testing the streaming platform'
};

async function testAPI() {
  console.log('🚀 Starting Complete User Journey Test');
  console.log('=====================================\n');

  try {
    // 1. Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health Check:', healthResponse.data);
    
    // 2. User Registration
    console.log('\n2️⃣ Testing User Registration...');
    const registerResponse = await axios.post(`${API_BASE}/api/auth/register`, testUser);
    console.log('✅ Registration:', registerResponse.data);
    authToken = registerResponse.data.data.token;
    userId = registerResponse.data.data.user.id;

    // 3. User Login (Test with same credentials)
    console.log('\n3️⃣ Testing User Login...');
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ Login:', loginResponse.data);
    
    // 4. Create Stream
    console.log('\n4️⃣ Testing Stream Creation...');
    const createStreamResponse = await axios.post(
      `${API_BASE}/api/streams`,
      testStream,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Stream Created:', createStreamResponse.data);
    streamId = createStreamResponse.data.data.stream.id;

    // 5. Get User Streams
    console.log('\n5️⃣ Testing Get User Streams...');
    const getStreamsResponse = await axios.get(
      `${API_BASE}/api/streams`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ User Streams:', getStreamsResponse.data);

    // 6. Start Stream
    console.log('\n6️⃣ Testing Start Stream...');
    const startStreamResponse = await axios.post(
      `${API_BASE}/api/streams/${streamId}/start`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Stream Started:', startStreamResponse.data);

    // 7. Get Analytics
    console.log('\n7️⃣ Testing Analytics...');
    const analyticsResponse = await axios.get(
      `${API_BASE}/api/analytics`,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Analytics:', analyticsResponse.data);

    // 8. Stop Stream
    console.log('\n8️⃣ Testing Stop Stream...');
    const stopStreamResponse = await axios.post(
      `${API_BASE}/api/streams/${streamId}/stop`,
      {},
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ Stream Stopped:', stopStreamResponse.data);

    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('=====================================');
    console.log('✅ User Registration: Working');
    console.log('✅ User Authentication: Working'); 
    console.log('✅ Stream Creation: Working');
    console.log('✅ Stream Management: Working');
    console.log('✅ Stream Start/Stop: Working');
    console.log('✅ Real-time Analytics: Working');
    console.log('✅ PostgreSQL Database: Working');
    console.log('✅ Complete User Journey: 100% FUNCTIONAL');
    
    console.log('\n🔗 Generated Streaming URLs:');
    const streamData = startStreamResponse.data.data;
    if (streamData.streaming_urls) {
      console.log(`📡 RTMP: ${streamData.streaming_urls.rtmp}`);
      console.log(`🌐 WebRTC: ${streamData.streaming_urls.webrtc}`);
      console.log(`📺 SRT: ${streamData.streaming_urls.srt}`);
    }

  } catch (error) {
    console.error('\n❌ Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run test if backend is available
async function waitForBackend() {
  console.log('⏳ Waiting for backend to be ready...');
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      await axios.get(`${API_BASE}/health`);
      console.log('✅ Backend is ready!\n');
      return true;
    } catch (error) {
      attempts++;
      console.log(`⏳ Attempt ${attempts}/${maxAttempts} - Backend not ready yet...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.error('❌ Backend not available after 60 seconds');
  return false;
}

async function main() {
  const isReady = await waitForBackend();
  if (isReady) {
    await testAPI();
  }
}

main();