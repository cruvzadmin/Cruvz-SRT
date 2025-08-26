#!/usr/bin/env node

/**
 * API Testing & Validation Script
 * Comprehensive testing of all backend APIs and OvenMediaEngine integration
 */

const axios = require('axios');
const fs = require('fs');

// Configuration
const API_BASE = 'http://localhost:5000';
const OME_API_BASE = 'http://localhost:8080';
const ADMIN_EMAIL = 'admin@cruvzstreaming.com';
const ADMIN_PASSWORD = 'Adm1n_Test_2025!_Qx7R$$gL3';

let authToken = null;
let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;

// Colors
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function pass(test) {
    testsRun++;
    testsPassed++;
    console.log(`${colors.green}✅ PASS${colors.reset} ${test}`);
}

function fail(test, reason) {
    testsRun++;
    testsFailed++;
    console.log(`${colors.red}❌ FAIL${colors.reset} ${test}`);
    if (reason) console.log(`   ${colors.red}→${colors.reset} ${reason}`);
}

function section(title) {
    console.log(`\n${colors.blue}📋 ${title}${colors.reset}`);
    console.log('─'.repeat(50));
}

// Helper function for API requests
async function apiRequest(endpoint, options = {}) {
    try {
        const config = {
            method: 'GET',
            url: `${API_BASE}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            timeout: 10000,
            ...options
        };

        if (config.data && typeof config.data === 'object') {
            config.data = JSON.stringify(config.data);
        }

        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data?.error || error.message,
            status: error.response?.status || 0
        };
    }
}

// Test system health and basic connectivity
async function testSystemHealth() {
    section('SYSTEM HEALTH & CONNECTIVITY');

    try {
        const response = await apiRequest('/health');
        if (response.success && response.data.success) {
            pass('Backend health endpoint responsive');
            
            if (response.data.database?.connected) {
                pass('Database connection healthy');
            } else {
                fail('Database connection failed');
            }
            
            if (response.data.redis?.connected) {
                pass('Redis connection healthy');
            } else {
                fail('Redis connection failed');
            }
        } else {
            fail('Backend health check failed', response.error);
        }
    } catch (error) {
        fail('Unable to connect to backend', error.message);
    }
}

// Test authentication system
async function testAuthentication() {
    section('AUTHENTICATION SYSTEM');

    try {
        // Test login
        const loginResponse = await apiRequest('/api/auth/login', {
            method: 'POST',
            data: {
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD
            }
        });

        if (loginResponse.success && loginResponse.data.data?.token) {
            authToken = loginResponse.data.data.token;
            pass('Admin login successful');
            pass('JWT token received');
        } else {
            fail('Admin login failed', loginResponse.error);
            return false;
        }

        // Test token validation
        const meResponse = await apiRequest('/api/auth/me');
        if (meResponse.success && meResponse.data.data?.email === ADMIN_EMAIL) {
            pass('Token validation successful');
        } else {
            fail('Token validation failed', meResponse.error);
        }

        return true;
    } catch (error) {
        fail('Authentication system error', error.message);
        return false;
    }
}

// Test all API endpoints
async function testAPIEndpoints() {
    section('API ENDPOINTS COVERAGE');

    const endpoints = [
        { path: '/api/streams', method: 'GET', name: 'List streams' },
        { path: '/api/analytics/dashboard', method: 'GET', name: 'Dashboard analytics' },
        { path: '/api/six-sigma/metrics', method: 'GET', name: 'Six Sigma metrics' },
        { path: '/api/transcoding/jobs', method: 'GET', name: 'Transcoding jobs' },
        { path: '/api/recordings', method: 'GET', name: 'Recordings list' },
        { path: '/api/publishing/targets', method: 'GET', name: 'Publishing targets' },
        { path: '/api/users/settings', method: 'GET', name: 'User settings' },
        { path: '/api/health/system', method: 'GET', name: 'System health' },
    ];

    for (const endpoint of endpoints) {
        try {
            const response = await apiRequest(endpoint.path, { method: endpoint.method });
            if (response.success) {
                pass(`${endpoint.name} endpoint working`);
            } else if (response.status === 401) {
                fail(`${endpoint.name} authentication required`, 'Check JWT implementation');
            } else {
                fail(`${endpoint.name} endpoint failed`, response.error);
            }
        } catch (error) {
            fail(`${endpoint.name} endpoint error`, error.message);
        }
    }
}

// Test streaming functionality
async function testStreamingFeatures() {
    section('STREAMING FEATURES');

    try {
        // Test stream creation
        const createStreamData = {
            title: 'Test Production Stream',
            description: 'Testing stream creation API',
            protocol: 'rtmp'
        };

        const createResponse = await apiRequest('/api/streams', {
            method: 'POST',
            data: createStreamData
        });

        if (createResponse.success && createResponse.data.data?.stream_key) {
            pass('Stream creation successful');
            const streamId = createResponse.data.data.id;
            const streamKey = createResponse.data.data.stream_key;
            
            // Test stream retrieval
            const getResponse = await apiRequest(`/api/streams/${streamId}`);
            if (getResponse.success) {
                pass('Stream retrieval successful');
            } else {
                fail('Stream retrieval failed', getResponse.error);
            }

            // Test stream key validation
            if (streamKey && streamKey.length > 8) {
                pass('Stream key generation valid');
            } else {
                fail('Stream key generation failed');
            }

            return streamId;
        } else {
            fail('Stream creation failed', createResponse.error);
        }
    } catch (error) {
        fail('Stream creation error', error.message);
    }

    return null;
}

// Test Six Sigma metrics
async function testSixSigmaMetrics() {
    section('SIX SIGMA METRICS SYSTEM');

    try {
        // Test metrics retrieval
        const metricsResponse = await apiRequest('/api/six-sigma/metrics');
        if (metricsResponse.success) {
            pass('Six Sigma metrics endpoint working');
            
            const metrics = metricsResponse.data.data;
            if (Array.isArray(metrics) && metrics.length > 0) {
                pass('Six Sigma metrics data available');
                
                // Check for required metric fields
                const firstMetric = metrics[0];
                const requiredFields = ['metric_name', 'value', 'target', 'sigma_level'];
                const hasAllFields = requiredFields.every(field => firstMetric.hasOwnProperty(field));
                
                if (hasAllFields) {
                    pass('Six Sigma metrics structure valid');
                } else {
                    fail('Six Sigma metrics structure incomplete');
                }
            } else {
                fail('No Six Sigma metrics data found');
            }
        } else {
            fail('Six Sigma metrics endpoint failed', metricsResponse.error);
        }

        // Test metrics calculation
        const calculationResponse = await apiRequest('/api/six-sigma/calculate', {
            method: 'POST',
            data: {
                metric_name: 'test_quality',
                values: [99.1, 99.3, 99.5, 99.2, 99.4],
                target: 99.5
            }
        });

        if (calculationResponse.success) {
            pass('Six Sigma calculation endpoint working');
        } else {
            fail('Six Sigma calculation failed', calculationResponse.error);
        }
    } catch (error) {
        fail('Six Sigma system error', error.message);
    }
}

// Test OvenMediaEngine integration
async function testOvenMediaEngine() {
    section('OVENMEDIAENGINE INTEGRATION');

    try {
        // Test OME health through backend proxy
        const omeHealthResponse = await apiRequest('/api/health/ome');
        if (omeHealthResponse.success) {
            pass('OvenMediaEngine health endpoint working');
            
            const omeData = omeHealthResponse.data.data;
            if (omeData && omeData.protocols) {
                pass('OME protocol status available');
                
                // Check for key protocols
                const expectedProtocols = ['RTMP', 'SRT', 'WebRTC', 'LLHLS'];
                const availableProtocols = Object.keys(omeData.protocols);
                const missingProtocols = expectedProtocols.filter(p => !availableProtocols.includes(p));
                
                if (missingProtocols.length === 0) {
                    pass('All key streaming protocols available');
                } else {
                    fail('Missing streaming protocols', missingProtocols.join(', '));
                }
            } else {
                fail('OME protocol data not available');
            }
        } else {
            fail('OvenMediaEngine health check failed', omeHealthResponse.error);
        }

        // Test streaming stats
        const statsResponse = await apiRequest('/api/streaming/stats');
        if (statsResponse.success) {
            pass('Streaming statistics endpoint working');
        } else {
            fail('Streaming statistics failed', statsResponse.error);
        }
    } catch (error) {
        fail('OvenMediaEngine integration error', error.message);
    }
}

// Test real-time features
async function testRealTimeFeatures() {
    section('REAL-TIME FEATURES');

    try {
        // Test analytics data
        const analyticsResponse = await apiRequest('/api/analytics/realtime');
        if (analyticsResponse.success) {
            pass('Real-time analytics endpoint working');
        } else {
            fail('Real-time analytics failed', analyticsResponse.error);
        }

        // Test dashboard data
        const dashboardResponse = await apiRequest('/api/analytics/dashboard');
        if (dashboardResponse.success && dashboardResponse.data.data) {
            pass('Dashboard analytics working');
            
            const dashData = dashboardResponse.data.data;
            const expectedMetrics = ['total_streams', 'active_viewers', 'system_health'];
            const hasMetrics = expectedMetrics.some(metric => dashData.hasOwnProperty(metric));
            
            if (hasMetrics) {
                pass('Dashboard metrics data structure valid');
            } else {
                fail('Dashboard metrics incomplete');
            }
        } else {
            fail('Dashboard analytics failed', dashboardResponse.error);
        }
    } catch (error) {
        fail('Real-time features error', error.message);
    }
}

// Main test execution
async function runAllTests() {
    console.log('🚀 COMPREHENSIVE API & FUNCTIONALITY TESTING');
    console.log('============================================\n');

    await testSystemHealth();
    
    const authSuccess = await testAuthentication();
    if (!authSuccess) {
        console.log('\n❌ Authentication failed - cannot continue with authenticated tests');
        return;
    }

    await testAPIEndpoints();
    await testStreamingFeatures();
    await testSixSigmaMetrics();
    await testOvenMediaEngine();
    await testRealTimeFeatures();

    // Final results
    section('TEST RESULTS SUMMARY');
    
    const successRate = ((testsPassed / testsRun) * 100).toFixed(1);
    console.log(`\n${colors.blue}📊 RESULTS${colors.reset}`);
    console.log(`   Total Tests: ${testsRun}`);
    console.log(`   ${colors.green}Passed: ${testsPassed}${colors.reset}`);
    console.log(`   ${colors.red}Failed: ${testsFailed}${colors.reset}`);
    console.log(`   Success Rate: ${successRate}%`);

    if (successRate >= 90) {
        console.log(`\n${colors.green}✅ API SYSTEM FULLY FUNCTIONAL${colors.reset}`);
    } else if (successRate >= 75) {
        console.log(`\n${colors.yellow}⚠️  API SYSTEM MOSTLY FUNCTIONAL${colors.reset}`);
    } else {
        console.log(`\n${colors.red}❌ API SYSTEM NEEDS WORK${colors.reset}`);
    }

    process.exit(testsFailed > 0 ? 1 : 0);
}

// Handle startup delay
setTimeout(runAllTests, 2000);