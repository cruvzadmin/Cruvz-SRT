#!/usr/bin/env node
/**
 * Quick OvenMediaEngine Streaming Test
 * Tests core functionality and generates a production readiness report
 */

const axios = require('axios');
const { execSync } = require('child_process');

const OME_API_URL = 'http://localhost:8080';
const OME_API_TOKEN = 'cruvz-production-api-token-2025';
const BACKEND_API_URL = 'http://localhost:5000';

class QuickStreamingTest {
  constructor() {
    this.results = {
      infrastructure: {},
      ovenmediaengine: {},
      protocols: {},
      summary: {}
    };
  }

  async run() {
    console.log('🚀 Quick Streaming Production Test\n');
    
    // Test 1: Infrastructure
    console.log('🔍 Testing Infrastructure...');
    await this.testInfrastructure();
    
    // Test 2: OvenMediaEngine
    console.log('🔍 Testing OvenMediaEngine...');
    await this.testOvenMediaEngine();
    
    // Test 3: Streaming Protocols
    console.log('🔍 Testing Streaming Protocols...');
    await this.testProtocols();
    
    // Generate Report
    this.generateReport();
  }

  async testInfrastructure() {
    try {
      // Test PostgreSQL
      try {
        execSync('docker exec cruvz-postgres-prod pg_isready -U cruvz -d cruvzdb', { stdio: 'pipe' });
        this.results.infrastructure.postgresql = '✅ Running';
      } catch (error) {
        this.results.infrastructure.postgresql = '❌ Failed';
      }
      
      // Test Redis
      try {
        execSync('docker exec cruvz-redis-prod redis-cli ping', { stdio: 'pipe' });
        this.results.infrastructure.redis = '✅ Running';
      } catch (error) {
        this.results.infrastructure.redis = '❌ Failed';
      }
      
      // Test Backend API
      try {
        const response = await axios.get(`${BACKEND_API_URL}/health`, { timeout: 5000 });
        this.results.infrastructure.backend_api = `✅ Running (${response.status})`;
      } catch (error) {
        this.results.infrastructure.backend_api = '❌ Failed';
      }
      
    } catch (error) {
      console.log('  Infrastructure test error:', error.message);
    }
  }

  async testOvenMediaEngine() {
    try {
      // Test OME API
      try {
        const response = await axios.get(`${OME_API_URL}/v1/stats/current`, {
          headers: { Authorization: OME_API_TOKEN },
          timeout: 5000
        });
        this.results.ovenmediaengine.api = `✅ Running (${response.status})`;
        this.results.ovenmediaengine.stats = response.data ? '✅ Available' : '❌ No data';
      } catch (error) {
        this.results.ovenmediaengine.api = '❌ Failed';
        this.results.ovenmediaengine.stats = '❌ Failed';
      }
      
      // Test VHosts
      try {
        const response = await axios.get(`${OME_API_URL}/v1/vhosts`, {
          headers: { Authorization: OME_API_TOKEN },
          timeout: 5000
        });
        const vhostCount = response.data?.response?.length || 0;
        this.results.ovenmediaengine.vhosts = `✅ ${vhostCount} configured`;
      } catch (error) {
        this.results.ovenmediaengine.vhosts = '❌ Failed';
      }
      
    } catch (error) {
      console.log('  OvenMediaEngine test error:', error.message);
    }
  }

  async testProtocols() {
    // Test RTMP port
    try {
      execSync('netstat -ln | grep :1935', { stdio: 'pipe' });
      this.results.protocols.rtmp = '✅ Port 1935 available';
    } catch (error) {
      this.results.protocols.rtmp = '❌ Port 1935 not available';
    }
    
    // Test SRT ports
    try {
      execSync('netstat -ln | grep :9999', { stdio: 'pipe' });
      this.results.protocols.srt_provider = '✅ Port 9999 available';
    } catch (error) {
      this.results.protocols.srt_provider = '❌ Port 9999 not available';
    }
    
    try {
      execSync('netstat -ln | grep :9998', { stdio: 'pipe' });
      this.results.protocols.srt_publisher = '✅ Port 9998 available';
    } catch (error) {
      this.results.protocols.srt_publisher = '❌ Port 9998 not available';
    }
    
    // Test WebRTC ports
    try {
      execSync('netstat -ln | grep :3333', { stdio: 'pipe' });
      this.results.protocols.webrtc_signaling = '✅ Port 3333 available';
    } catch (error) {
      this.results.protocols.webrtc_signaling = '❌ Port 3333 not available';
    }
    
    // Test LLHLS ports
    try {
      execSync('netstat -ln | grep :8088', { stdio: 'pipe' });
      this.results.protocols.llhls = '✅ Port 8088 available';
    } catch (error) {
      this.results.protocols.llhls = '❌ Port 8088 not available';
    }
    
    // Test MPEGTS ports
    try {
      execSync('netstat -ln | grep :4000', { stdio: 'pipe' });
      this.results.protocols.mpegts = '✅ Port 4000 available';
    } catch (error) {
      this.results.protocols.mpegts = '❌ Port 4000 not available';
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PRODUCTION STREAMING READINESS REPORT');
    console.log('='.repeat(60));
    
    console.log('\n🏗️  INFRASTRUCTURE:');
    Object.entries(this.results.infrastructure).forEach(([key, value]) => {
      console.log(`  ${key.toUpperCase().replace('_', ' ')}: ${value}`);
    });
    
    console.log('\n🎥 OVENMEDIAENGINE:');
    Object.entries(this.results.ovenmediaengine).forEach(([key, value]) => {
      console.log(`  ${key.toUpperCase().replace('_', ' ')}: ${value}`);
    });
    
    console.log('\n🌐 STREAMING PROTOCOLS:');
    Object.entries(this.results.protocols).forEach(([key, value]) => {
      console.log(`  ${key.toUpperCase().replace('_', ' ')}: ${value}`);
    });
    
    // Calculate readiness score
    const allResults = [
      ...Object.values(this.results.infrastructure),
      ...Object.values(this.results.ovenmediaengine),
      ...Object.values(this.results.protocols)
    ];
    
    const passedTests = allResults.filter(result => result.includes('✅')).length;
    const totalTests = allResults.length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    console.log('\n📈 SUMMARY:');
    console.log(`  Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`  Success Rate: ${successRate}%`);
    
    const productionReady = successRate >= 80;
    console.log(`  Production Ready: ${productionReady ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n🚀 STREAMING PROTOCOLS AVAILABLE:');
    console.log('  • RTMP: rtmp://localhost:1935/app/{stream_name}');
    console.log('  • SRT Input: srt://localhost:9999?streamid=input/app/{stream_name}');
    console.log('  • SRT Output: srt://localhost:9998?streamid=app/{stream_name}');
    console.log('  • WebRTC: ws://localhost:3333/app/{stream_name}');
    console.log('  • LLHLS: http://localhost:8088/app/{stream_name}/llhls.m3u8');
    console.log('  • HLS: http://localhost:8088/app/{stream_name}/playlist.m3u8');
    
    console.log('\n🎯 NEXT STEPS:');
    if (productionReady) {
      console.log('  1. ✅ Platform is production-ready');
      console.log('  2. 🎥 Create test streams using the URLs above');
      console.log('  3. 📱 Test frontend streaming interface');
      console.log('  4. 🔍 Monitor analytics and performance');
    } else {
      console.log('  1. ❌ Fix failed components before production');
      console.log('  2. 🔄 Re-run tests after fixes');
      console.log('  3. 📊 Ensure all protocols are working');
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// Run test
const test = new QuickStreamingTest();
test.run().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});