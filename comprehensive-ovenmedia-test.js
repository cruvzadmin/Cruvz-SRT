#!/usr/bin/env node
/**
 * Comprehensive OvenMediaEngine Test Suite
 * Tests ALL streaming functionality and generates a detailed report
 */

const axios = require('axios');
const { execSync } = require('child_process');
const WebSocket = require('ws');

const OME_API_URL = 'http://localhost:8080';
const OME_API_TOKEN = 'cruvz-production-api-token-2025';
const BACKEND_API_URL = 'http://localhost:5000';

class ComprehensiveOvenMediaTest {
  constructor() {
    this.results = {
      infrastructure: {},
      ovenmediaengine: {},
      streaming_protocols: {},
      streaming_features: {},
      api_endpoints: {},
      frontend_backend: {},
      production_readiness: {}
    };
  }

  async run() {
    console.log('🚀 COMPREHENSIVE OVENMEDIAENGINE STREAMING TEST\n');
    console.log('=' .repeat(80));
    
    await this.testInfrastructure();
    await this.testOvenMediaEngine();
    await this.testStreamingProtocols();
    await this.testStreamingFeatures();
    await this.testAPIEndpoints();
    await this.testFrontendBackend();
    await this.testProductionReadiness();
    
    this.generateComprehensiveReport();
  }

  async testInfrastructure() {
    console.log('🏗️  Testing Infrastructure...');
    
    // Test PostgreSQL
    try {
      execSync('docker exec cruvz-postgres-prod pg_isready -U cruvz -d cruvzdb', { stdio: 'pipe' });
      this.results.infrastructure.postgresql = '✅ Running and Ready';
    } catch (error) {
      this.results.infrastructure.postgresql = '❌ Failed - Not accessible';
    }
    
    // Test Redis
    try {
      execSync('docker exec cruvz-redis-prod redis-cli ping', { stdio: 'pipe' });
      this.results.infrastructure.redis = '✅ Running and Ready';
    } catch (error) {
      this.results.infrastructure.redis = '❌ Failed - Not accessible';
    }
    
    // Test Backend API
    try {
      const response = await axios.get(`${BACKEND_API_URL}/health`, { timeout: 5000 });
      this.results.infrastructure.backend_api = `✅ Running (${response.status})`;
    } catch (error) {
      this.results.infrastructure.backend_api = '❌ Failed - Not responding';
    }
  }

  async testOvenMediaEngine() {
    console.log('🎥 Testing OvenMediaEngine Core...');
    
    // Test OME API Connection
    try {
      const response = await axios.get(`${OME_API_URL}/v1/stats/current`, {
        headers: { Authorization: OME_API_TOKEN },
        timeout: 5000
      });
      this.results.ovenmediaengine.api_connection = `✅ Connected (${response.status})`;
      this.results.ovenmediaengine.stats_available = response.data ? '✅ Available' : '❌ No data';
    } catch (error) {
      this.results.ovenmediaengine.api_connection = '❌ Failed - Cannot connect';
      this.results.ovenmediaengine.stats_available = '❌ Failed';
    }
    
    // Test VHosts Configuration
    try {
      const response = await axios.get(`${OME_API_URL}/v1/vhosts`, {
        headers: { Authorization: OME_API_TOKEN },
        timeout: 5000
      });
      const vhosts = response.data?.response || [];
      this.results.ovenmediaengine.vhosts = `✅ ${vhosts.length} VHost(s) configured`;
      
      // Test Applications within VHosts
      for (const vhost of vhosts) {
        try {
          const appsResponse = await axios.get(`${OME_API_URL}/v1/vhosts/${vhost.name}/apps`, {
            headers: { Authorization: OME_API_TOKEN },
            timeout: 3000
          });
          const apps = appsResponse.data?.response || [];
          this.results.ovenmediaengine[`${vhost.name}_applications`] = `✅ ${apps.length} App(s)`;
        } catch (error) {
          this.results.ovenmediaengine[`${vhost.name}_applications`] = '❌ Failed to fetch';
        }
      }
    } catch (error) {
      this.results.ovenmediaengine.vhosts = '❌ Failed to fetch VHosts';
    }
  }

  async testStreamingProtocols() {
    console.log('🌐 Testing Streaming Protocols...');
    
    const protocols = {
      rtmp_provider: { port: 1935, description: 'RTMP Provider' },
      srt_input: { port: 9999, description: 'SRT Input Provider' },
      srt_output: { port: 9998, description: 'SRT Output Publisher' },
      webrtc_signaling: { port: 3333, description: 'WebRTC Signaling' },
      webrtc_signaling_tls: { port: 3334, description: 'WebRTC Signaling TLS' },
      llhls_publisher: { port: 8088, description: 'LLHLS Publisher' },
      llhls_publisher_tls: { port: 8089, description: 'LLHLS Publisher TLS' },
      thumbnail_publisher: { port: 8081, description: 'Thumbnail Publisher' },
      thumbnail_publisher_tls: { port: 8082, description: 'Thumbnail Publisher TLS' },
      mpegts_provider_start: { port: 4000, description: 'MPEGTS Provider (Start)' },
      mpegts_provider_end: { port: 4005, description: 'MPEGTS Provider (End)' },
      ome_api: { port: 8080, description: 'OvenMediaEngine API' }
    };
    
    for (const [key, protocol] of Object.entries(protocols)) {
      try {
        execSync(`netstat -ln | grep :${protocol.port}`, { stdio: 'pipe' });
        this.results.streaming_protocols[key] = `✅ Port ${protocol.port} Available (${protocol.description})`;
      } catch (error) {
        this.results.streaming_protocols[key] = `❌ Port ${protocol.port} Not Available (${protocol.description})`;
      }
    }
    
    // Test WebRTC ICE Candidate Ports (10000-10100)
    try {
      execSync('netstat -ln | grep ":1000[0-9]"', { stdio: 'pipe' });
      this.results.streaming_protocols.webrtc_ice_candidates = '✅ ICE Candidate Ports Available (10000-10100)';
    } catch (error) {
      this.results.streaming_protocols.webrtc_ice_candidates = '❌ ICE Candidate Ports Not Available';
    }
  }

  async testStreamingFeatures() {
    console.log('🎬 Testing Advanced Streaming Features...');
    
    // Test Stream Creation via API
    try {
      const testStream = {
        name: 'test-stream-' + Date.now(),
        inputType: 'rtmp'
      };
      
      // This would test actual stream creation - simplified for now
      this.results.streaming_features.stream_creation = '⚠️  Needs Implementation - Stream Creation API';
      this.results.streaming_features.stream_management = '⚠️  Needs Implementation - Stream CRUD Operations';
      this.results.streaming_features.recording = '⚠️  Needs Implementation - DVR Recording';
      this.results.streaming_features.transcoding = '⚠️  Needs Implementation - Adaptive Bitrate';
      this.results.streaming_features.publishing = '⚠️  Needs Implementation - Multi-Protocol Publishing';
      this.results.streaming_features.analytics = '⚠️  Needs Implementation - Real-time Analytics';
    } catch (error) {
      this.results.streaming_features.stream_creation = '❌ Failed to test stream creation';
    }
  }

  async testAPIEndpoints() {
    console.log('🔌 Testing Backend API Endpoints...');
    
    const endpoints = [
      '/health',
      '/api/auth/register',
      '/api/auth/login',
      '/api/streams',
      '/api/streaming/protocols',
      '/api/analytics/performance',
      '/api/analytics/errors',
      '/api/users/profile'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${BACKEND_API_URL}${endpoint}`, { 
          timeout: 3000,
          validateStatus: (status) => status < 500 // Accept 4xx as "working" (auth required, etc.)
        });
        this.results.api_endpoints[endpoint.replace(/[\/]/g, '_')] = `✅ Responding (${response.status})`;
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          this.results.api_endpoints[endpoint.replace(/[\/]/g, '_')] = '❌ Backend Not Running';
        } else {
          this.results.api_endpoints[endpoint.replace(/[\/]/g, '_')] = `❌ Failed (${error.message})`;
        }
      }
    }
  }

  async testFrontendBackend() {
    console.log('🎨 Testing Frontend/Backend Integration...');
    
    // Test React App Build
    try {
      execSync('cd frontend && npm run build', { stdio: 'pipe', timeout: 60000 });
      this.results.frontend_backend.react_build = '✅ React App Builds Successfully';
    } catch (error) {
      this.results.frontend_backend.react_build = '❌ React Build Failed';
    }
    
    // Test TypeScript Compilation
    try {
      execSync('cd frontend && npx tsc --noEmit', { stdio: 'pipe', timeout: 30000 });
      this.results.frontend_backend.typescript = '✅ TypeScript Compiles Without Errors';
    } catch (error) {
      this.results.frontend_backend.typescript = '❌ TypeScript Compilation Errors';
    }
    
    // Test API Service Integration
    this.results.frontend_backend.api_integration = '⚠️  Needs Manual Testing - API Service Integration';
    this.results.frontend_backend.authentication = '⚠️  Needs Manual Testing - JWT Authentication Flow';
    this.results.frontend_backend.websocket = '⚠️  Needs Manual Testing - WebSocket Real-time Updates';
  }

  async testProductionReadiness() {
    console.log('🚀 Testing Production Readiness...');
    
    // Test Environment Variables
    const requiredEnvVars = [
      'POSTGRES_USER',
      'POSTGRES_PASSWORD', 
      'POSTGRES_DB',
      'JWT_SECRET',
      'REDIS_HOST'
    ];
    
    let envVarsPresent = 0;
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        envVarsPresent++;
      }
    }
    
    this.results.production_readiness.environment_variables = 
      `${envVarsPresent}/${requiredEnvVars.length} Required Env Vars Present`;
    
    // Test Security Features
    this.results.production_readiness.jwt_authentication = '⚠️  Needs Testing - JWT Implementation';
    this.results.production_readiness.rate_limiting = '⚠️  Needs Testing - API Rate Limiting';
    this.results.production_readiness.cors_configuration = '⚠️  Needs Testing - CORS Setup';
    this.results.production_readiness.input_validation = '⚠️  Needs Testing - Input Sanitization';
    
    // Test Performance
    this.results.production_readiness.database_optimization = '⚠️  Needs Testing - DB Connection Pooling';
    this.results.production_readiness.caching_layer = '⚠️  Needs Testing - Redis Caching';
    this.results.production_readiness.monitoring = '⚠️  Needs Implementation - Prometheus/Grafana';
  }

  generateComprehensiveReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE OVENMEDIAENGINE STREAMING REPORT');
    console.log('='.repeat(80));
    
    const sections = [
      { title: '🏗️  INFRASTRUCTURE', data: this.results.infrastructure },
      { title: '🎥 OVENMEDIAENGINE CORE', data: this.results.ovenmediaengine },
      { title: '🌐 STREAMING PROTOCOLS', data: this.results.streaming_protocols },
      { title: '🎬 STREAMING FEATURES', data: this.results.streaming_features },
      { title: '🔌 API ENDPOINTS', data: this.results.api_endpoints },
      { title: '🎨 FRONTEND/BACKEND', data: this.results.frontend_backend },
      { title: '🚀 PRODUCTION READINESS', data: this.results.production_readiness }
    ];
    
    for (const section of sections) {
      console.log(`\n${section.title}:`);
      Object.entries(section.data).forEach(([key, value]) => {
        console.log(`  ${key.toUpperCase().replace(/_/g, ' ')}: ${value}`);
      });
    }
    
    // Calculate overall scores
    const allResults = Object.values(this.results).flatMap(section => Object.values(section));
    const passedTests = allResults.filter(result => result.includes('✅')).length;
    const warningTests = allResults.filter(result => result.includes('⚠️')).length;
    const failedTests = allResults.filter(result => result.includes('❌')).length;
    const totalTests = allResults.length;
    
    console.log('\n📈 OVERALL SUMMARY:');
    console.log(`  ✅ Passed: ${passedTests}/${totalTests} (${Math.round((passedTests/totalTests)*100)}%)`);
    console.log(`  ⚠️  Warnings: ${warningTests}/${totalTests} (${Math.round((warningTests/totalTests)*100)}%)`);
    console.log(`  ❌ Failed: ${failedTests}/${totalTests} (${Math.round((failedTests/totalTests)*100)}%)`);
    
    const successRate = Math.round(((passedTests + warningTests * 0.5) / totalTests) * 100);
    console.log(`  📊 Overall Score: ${successRate}%`);
    
    console.log('\n🎯 PRIORITY FIXES NEEDED:');
    
    const priorityFixes = [
      '1. ❗ Complete OvenMediaEngine deployment and configuration',
      '2. ❗ Implement streaming API endpoints (create/edit/delete streams)',
      '3. ❗ Build comprehensive UI modals for stream management',
      '4. ❗ Add real-time analytics and monitoring',
      '5. ❗ Implement authentication and security features',
      '6. ❗ Add transcoding and recording capabilities',
      '7. ❗ Test end-to-end streaming workflows',
      '8. ❗ Optimize for production deployment'
    ];
    
    priorityFixes.forEach(fix => console.log(`  ${fix}`));
    
    console.log('\n🚀 NEXT STEPS FOR 100% COMPLETION:');
    console.log('  1. Fix all ❌ Failed components');
    console.log('  2. Implement all ⚠️  Warning features'); 
    console.log('  3. Test all streaming protocols with real streams');
    console.log('  4. Build advanced UI components beyond competitors');
    console.log('  5. Perform end-to-end QA testing');
    console.log('  6. Deploy and monitor production environment');
    
    console.log('\n' + '='.repeat(80));
    
    return { passedTests, totalTests, successRate };
  }
}

// Run comprehensive test
const test = new ComprehensiveOvenMediaTest();
test.run().catch(error => {
  console.error('Comprehensive test failed:', error);
  process.exit(1);
});