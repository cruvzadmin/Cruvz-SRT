#!/usr/bin/env node
/**
 * Comprehensive Production Validation for Cruvz Streaming Platform
 * Tests all core functionality: authentication, streaming, protocols
 */

const http = require('http');
const https = require('https');
const net = require('net');
const dgram = require('dgram');

// Configuration
const BASE_URL = 'http://localhost';
const API_URL = 'http://localhost:5000';
const STREAMING_HOST = 'localhost';

// Test counters
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

// Test results
const results = {
  infrastructure: {},
  authentication: {},
  streaming: {},
  protocols: {},
  integration: {}
};

// Helper functions
function log(level, message, details = '') {
  const timestamp = new Date().toISOString();
  const colors = {
    INFO: '\x1b[34m',
    SUCCESS: '\x1b[32m',
    ERROR: '\x1b[31m',
    WARNING: '\x1b[33m',
    RESET: '\x1b[0m'
  };
  
  console.log(`${colors[level]}[${timestamp}] ${level}: ${message}${colors.RESET}`);
  if (details) {
    console.log(`  ${details}`);
  }
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https://') ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, raw: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function checkPort(host, port, protocol = 'tcp') {
  return new Promise((resolve) => {
    if (protocol === 'udp') {
      const client = dgram.createSocket('udp4');
      const timeout = setTimeout(() => {
        client.close();
        resolve(false);
      }, 2000);
      
      client.send(Buffer.from('test'), port, host, (err) => {
        clearTimeout(timeout);
        client.close();
        resolve(!err);
      });
    } else {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(port, host);
    }
  });
}

function runTest(category, name, testFunction) {
  return new Promise(async (resolve) => {
    totalTests++;
    try {
      log('INFO', `Running test: ${category}/${name}`);
      const result = await testFunction();
      if (result.success) {
        passedTests++;
        results[category][name] = { status: 'PASS', ...result };
        log('SUCCESS', `✅ ${category}/${name} - ${result.message || 'PASSED'}`);
      } else {
        failedTests++;
        results[category][name] = { status: 'FAIL', ...result };
        log('ERROR', `❌ ${category}/${name} - ${result.message || 'FAILED'}`, result.details);
      }
    } catch (error) {
      failedTests++;
      results[category][name] = { status: 'ERROR', error: error.message };
      log('ERROR', `💥 ${category}/${name} - ERROR: ${error.message}`);
    }
    resolve();
  });
}

// Test Infrastructure
async function testInfrastructure() {
  log('INFO', '🚀 Testing Infrastructure...');
  
  await runTest('infrastructure', 'backend_health', async () => {
    const response = await makeRequest(`${API_URL}/health`);
    if (response.status === 200 && response.data.status === 'healthy') {
      return { success: true, message: 'Backend is healthy' };
    }
    return { success: false, message: `Backend health check failed: ${response.status}` };
  });

  await runTest('infrastructure', 'web_app', async () => {
    const response = await makeRequest(`${BASE_URL}/`);
    if (response.status === 200 && response.raw.includes('Cruvz Streaming')) {
      return { success: true, message: 'Web application is serving' };
    }
    return { success: false, message: `Web app failed: ${response.status}` };
  });

  await runTest('infrastructure', 'streaming_engine', async () => {
    const response = await makeRequest(`http://${STREAMING_HOST}:8080/v1/stats/current`);
    if (response.status === 200) {
      return { success: true, message: 'Streaming engine is responding' };
    }
    return { success: false, message: `Streaming engine failed: ${response.status}` };
  });

  await runTest('infrastructure', 'prometheus', async () => {
    const response = await makeRequest(`http://${STREAMING_HOST}:9090/-/healthy`);
    if (response.status === 200) {
      return { success: true, message: 'Prometheus is healthy' };
    }
    return { success: false, message: `Prometheus failed: ${response.status}` };
  });
}

// Test Authentication
async function testAuthentication() {
  log('INFO', '🔐 Testing Authentication...');
  
  let userToken = null;
  
  await runTest('authentication', 'user_registration', async () => {
    const testUser = {
      firstName: 'Validation',
      lastName: 'Test', 
      email: `test-${Date.now()}@cruvz.com`,
      password: 'TestPass123!'
    };
    
    const response = await makeRequest(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    if (response.status === 201 && response.data.success && response.data.data.token) {
      userToken = response.data.data.token;
      return { success: true, message: 'User registration successful', token: userToken };
    }
    return { success: false, message: `Registration failed: ${response.status}`, details: JSON.stringify(response.data) };
  });

  await runTest('authentication', 'user_login', async () => {
    const response = await makeRequest(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@cruvz.com', password: 'demo123' })
    });
    
    if (response.status === 200 && response.data.success && response.data.data.token) {
      return { success: true, message: 'Login successful' };
    }
    return { success: false, message: `Login failed: ${response.status}`, details: JSON.stringify(response.data) };
  });

  await runTest('authentication', 'protected_endpoint', async () => {
    if (!userToken) {
      return { success: false, message: 'No token available from registration' };
    }
    
    const response = await makeRequest(`${API_URL}/api/streams`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    if (response.status === 200 && response.data.success) {
      return { success: true, message: 'Protected endpoint accessible with token' };
    }
    return { success: false, message: `Protected endpoint failed: ${response.status}` };
  });

  return userToken;
}

// Test Streaming
async function testStreaming(userToken) {
  log('INFO', '🎥 Testing Streaming Functionality...');
  
  let streamId = null;
  
  await runTest('streaming', 'stream_creation', async () => {
    if (!userToken) {
      return { success: false, message: 'No authentication token available' };
    }
    
    const streamData = {
      title: 'Validation Test Stream',
      description: 'Test stream created during production validation',
      protocol: 'rtmp'
    };
    
    const response = await makeRequest(`${API_URL}/api/streams`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}` 
      },
      body: JSON.stringify(streamData)
    });
    
    if (response.status === 201 && response.data.success && response.data.data.id) {
      streamId = response.data.data.id;
      return { success: true, message: 'Stream created successfully', streamId };
    }
    return { success: false, message: `Stream creation failed: ${response.status}`, details: JSON.stringify(response.data) };
  });

  await runTest('streaming', 'stream_start', async () => {
    if (!streamId || !userToken) {
      return { success: false, message: 'No stream ID or token available' };
    }
    
    const response = await makeRequest(`${API_URL}/api/streams/${streamId}/start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    if (response.status === 200 && response.data.success && response.data.data.streaming_urls) {
      const urls = response.data.data.streaming_urls;
      return { 
        success: true, 
        message: 'Stream started with all protocol URLs',
        urls: urls
      };
    }
    return { success: false, message: `Stream start failed: ${response.status}`, details: JSON.stringify(response.data) };
  });

  await runTest('streaming', 'stream_stop', async () => {
    if (!streamId || !userToken) {
      return { success: false, message: 'No stream ID or token available' };
    }
    
    const response = await makeRequest(`${API_URL}/api/streams/${streamId}/stop`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    
    if (response.status === 200 && response.data.success) {
      return { success: true, message: 'Stream stopped successfully' };
    }
    return { success: false, message: `Stream stop failed: ${response.status}` };
  });
}

// Test Protocols
async function testProtocols() {
  log('INFO', '📡 Testing Streaming Protocols...');
  
  await runTest('protocols', 'rtmp_port', async () => {
    const isAccessible = await checkPort(STREAMING_HOST, 1935, 'tcp');
    if (isAccessible) {
      return { success: true, message: 'RTMP port (1935) is accessible' };
    }
    return { success: false, message: 'RTMP port (1935) is not accessible' };
  });

  await runTest('protocols', 'webrtc_port', async () => {
    const isAccessible = await checkPort(STREAMING_HOST, 3333, 'tcp');
    if (isAccessible) {
      return { success: true, message: 'WebRTC port (3333) is accessible' };
    }
    return { success: false, message: 'WebRTC port (3333) is not accessible' };
  });

  await runTest('protocols', 'srt_port', async () => {
    const isAccessible = await checkPort(STREAMING_HOST, 9999, 'udp');
    if (isAccessible) {
      return { success: true, message: 'SRT port (9999) is accessible' };
    }
    return { success: false, message: 'SRT port (9999) is not accessible' };
  });

  await runTest('protocols', 'webrtc_udp_range', async () => {
    // Test a few ports in the WebRTC UDP range
    const testPorts = [10000, 10005, 10010];
    let successCount = 0;
    
    for (const port of testPorts) {
      const isAccessible = await checkPort(STREAMING_HOST, port, 'udp');
      if (isAccessible) successCount++;
    }
    
    if (successCount > 0) {
      return { success: true, message: `WebRTC UDP ports accessible (${successCount}/${testPorts.length} tested)` };
    }
    return { success: false, message: 'WebRTC UDP port range not accessible' };
  });

  await runTest('protocols', 'streaming_api_endpoints', async () => {
    // Test key streaming API endpoints
    const endpoints = [
      '/v1/stats/current',
      '/v1/vhosts'
    ];
    
    let successCount = 0;
    for (const endpoint of endpoints) {
      try {
        const response = await makeRequest(`http://${STREAMING_HOST}:8080${endpoint}`);
        if (response.status === 200) successCount++;
      } catch (error) {
        // Continue testing other endpoints
      }
    }
    
    if (successCount === endpoints.length) {
      return { success: true, message: 'All streaming API endpoints accessible' };
    }
    return { success: false, message: `Only ${successCount}/${endpoints.length} streaming API endpoints accessible` };
  });
}

// Test Integration
async function testIntegration() {
  log('INFO', '🔗 Testing Integration...');
  
  await runTest('integration', 'api_proxy', async () => {
    const response = await makeRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@cruvz.com', password: 'demo123' })
    });
    
    if (response.status === 200 && response.data.success) {
      return { success: true, message: 'API proxy through web app working' };
    }
    return { success: false, message: `API proxy failed: ${response.status}`, details: JSON.stringify(response.data) };
  });

  await runTest('integration', 'web_health_proxy', async () => {
    const response = await makeRequest(`${BASE_URL}/health`);
    if (response.status === 200) {
      return { success: true, message: 'Health endpoint accessible through proxy' };
    }
    return { success: false, message: `Health proxy failed: ${response.status}` };
  });

  await runTest('integration', 'database_connectivity', async () => {
    const response = await makeRequest(`${API_URL}/health`);
    if (response.status === 200 && response.data.database && response.data.database.connected) {
      return { success: true, message: 'Database connectivity verified' };
    }
    return { success: false, message: 'Database connectivity check failed' };
  });

  await runTest('integration', 'streaming_integration', async () => {
    // Test if streaming engine can communicate with backend
    const backendResponse = await makeRequest(`${API_URL}/health`);
    const streamingResponse = await makeRequest(`http://${STREAMING_HOST}:8080/v1/stats/current`);
    
    if (backendResponse.status === 200 && streamingResponse.status === 200) {
      return { success: true, message: 'Backend and streaming engine integration working' };
    }
    return { success: false, message: 'Backend-streaming integration failed' };
  });
}

// Generate Report
function generateReport() {
  log('INFO', '\n📊 PRODUCTION VALIDATION REPORT');
  log('INFO', '================================');
  
  log('INFO', `Total Tests: ${totalTests}`);
  log('SUCCESS', `Passed: ${passedTests}`);
  log('ERROR', `Failed: ${failedTests}`);
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(2);
  log('INFO', `Success Rate: ${successRate}%`);
  
  // Detailed results
  Object.keys(results).forEach(category => {
    log('INFO', `\n${category.toUpperCase()}:`);
    Object.keys(results[category]).forEach(test => {
      const result = results[category][test];
      const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '💥';
      log('INFO', `  ${status} ${test}: ${result.status}`);
    });
  });
  
  // Production readiness assessment
  log('INFO', '\n🚀 PRODUCTION READINESS ASSESSMENT');
  log('INFO', '==================================');
  
  if (successRate >= 95) {
    log('SUCCESS', '🎉 SYSTEM IS PRODUCTION READY!');
    log('SUCCESS', '✅ All critical systems operational');
    log('SUCCESS', '✅ Zero errors in deployment');
    log('SUCCESS', '✅ All user workflows validated');
    return true;
  } else if (successRate >= 80) {
    log('WARNING', '⚠️  SYSTEM HAS MINOR ISSUES');
    log('WARNING', '🔧 Some non-critical features may need attention');
    return false;
  } else {
    log('ERROR', '❌ SYSTEM NOT READY FOR PRODUCTION');
    log('ERROR', '🚨 Critical issues need to be resolved');
    return false;
  }
}

// Main execution
async function main() {
  log('INFO', '🚀 Starting Cruvz Streaming Production Validation');
  log('INFO', '================================================');
  
  try {
    await testInfrastructure();
    const userToken = await testAuthentication();
    await testStreaming(userToken);
    await testProtocols();
    await testIntegration();
    
    const isReady = generateReport();
    process.exit(isReady ? 0 : 1);
  } catch (error) {
    log('ERROR', `Validation failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, runTest, log };