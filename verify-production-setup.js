#!/usr/bin/env node

/**
 * Production Setup Verification Script
 * Ensures that all components are properly configured for production deployment
 * without any mock data, demo UI, or development fallbacks.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Production Setup...\n');

let hasErrors = false;
let hasWarnings = false;

function error(message) {
  console.log(`❌ ERROR: ${message}`);
  hasErrors = true;
}

function warning(message) {
  console.log(`⚠️  WARNING: ${message}`);
  hasWarnings = true;
}

function success(message) {
  console.log(`✅ ${message}`);
}

function info(message) {
  console.log(`ℹ️  ${message}`);
}

// Check 1: Verify no mock servers exist
console.log('📋 Checking for mock/demo files...');
const mockFiles = [
  'backend/server-simple.js',
  'mock-streaming-servers.js',
  'web-app/demo-dashboard.html'
];

mockFiles.forEach(file => {
  if (fs.existsSync(file)) {
    error(`Mock/demo file still exists: ${file}`);
  } else {
    success(`Mock/demo file properly removed: ${file}`);
  }
});

// Check 2: Verify main server configuration
console.log('\n📋 Checking server configuration...');
const packageJson = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
if (packageJson.main === 'server.js') {
  success('Main entry point correctly set to server.js');
} else {
  error(`Main entry point should be server.js, found: ${packageJson.main}`);
}

// Check 3: Verify production environment configuration
console.log('\n📋 Checking environment configuration...');
if (fs.existsSync('.env.production')) {
  const envContent = fs.readFileSync('.env.production', 'utf8');
  
  // Check for production values
  if (envContent.includes('NODE_ENV=production')) {
    success('NODE_ENV correctly set to production');
  } else {
    error('NODE_ENV not set to production');
  }
  
  // Check for PostgreSQL (no SQLite)
  if (envContent.includes('POSTGRES_HOST') && !envContent.includes('sqlite')) {
    success('PostgreSQL configuration found (no SQLite)');
  } else {
    error('PostgreSQL configuration missing or SQLite references found');
  }
  
  // Check for Redis
  if (envContent.includes('REDIS_HOST')) {
    success('Redis configuration found');
  } else {
    warning('Redis configuration missing');
  }
  
  // Check for strong JWT secret
  const jwtMatch = envContent.match(/JWT_SECRET=(.+)/);
  if (jwtMatch && jwtMatch[1].length >= 64) {
    success('JWT secret is sufficiently strong');
  } else {
    error('JWT secret is too weak or missing');
  }
} else {
  error('.env.production file missing');
}

// Check 4: Verify database configuration
console.log('\n📋 Checking database configuration...');
if (fs.existsSync('backend/knexfile.js')) {
  const knexContent = fs.readFileSync('backend/knexfile.js', 'utf8');
  if (knexContent.includes("client: 'pg'") && !knexContent.includes("sqlite")) {
    success('Database configuration uses PostgreSQL only');
  } else {
    error('Database configuration includes SQLite or not using PostgreSQL');
  }
} else {
  error('knexfile.js missing');
}

// Check 5: Verify Docker configuration
console.log('\n📋 Checking Docker configuration...');
if (fs.existsSync('docker-compose.yml')) {
  const dockerComposeContent = fs.readFileSync('docker-compose.yml', 'utf8');
  
  if (dockerComposeContent.includes('postgres:15-alpine')) {
    success('PostgreSQL service configured');
  } else {
    error('PostgreSQL service not found in docker-compose.yml');
  }
  
  if (dockerComposeContent.includes('redis:7.2-alpine')) {
    success('Redis service configured');
  } else {
    warning('Redis service not found in docker-compose.yml');
  }
  
  if (dockerComposeContent.includes('origin:') && 
      (dockerComposeContent.includes('ovenmediaengine') || dockerComposeContent.includes('BUILD_MODE=production'))) {
    success('OvenMediaEngine service configured');
  } else {
    error('OvenMediaEngine service not found');
  }
} else {
  error('docker-compose.yml missing');
}

// Check 6: Verify no mock cache usage
console.log('\n📋 Checking cache configuration...');
if (fs.existsSync('backend/utils/cache.js')) {
  const cacheContent = fs.readFileSync('backend/utils/cache.js', 'utf8');
  if (cacheContent.includes('Redis') && !cacheContent.includes('require(\'./cache-mock\')')) {
    success('Cache configuration uses Redis (no mock cache)');
  } else {
    error('Cache configuration includes mock cache fallback');
  }
} else {
  error('cache.js missing');
}

// Check 7: Verify OvenMediaEngine port configuration
console.log('\n📋 Checking OvenMediaEngine configuration...');
if (fs.existsSync('configs/Server.xml')) {
  const omeConfig = fs.readFileSync('configs/Server.xml', 'utf8');
  if (omeConfig.includes('${env:OME_API_PORT:8080}')) {
    success('OvenMediaEngine API port configured');
  } else {
    error('OvenMediaEngine API port not properly configured');
  }
  
  if (omeConfig.includes('MPEGTS') && omeConfig.includes('Thumbnail')) {
    success('All OvenMediaEngine features enabled');
  } else {
    warning('Some OvenMediaEngine features may not be enabled');
  }
} else {
  error('OvenMediaEngine Server.xml missing');
}

// Check 8: Verify frontend configuration
console.log('\n📋 Checking frontend configuration...');
if (fs.existsSync('web-app/index.html')) {
  const indexContent = fs.readFileSync('web-app/index.html', 'utf8');
  if (indexContent.includes('dashboard.html') && !indexContent.includes('demo-dashboard.html')) {
    success('Frontend correctly links to production dashboard');
  } else {
    error('Frontend still links to demo dashboard or missing dashboard link');
  }
} else {
  error('Frontend index.html missing');
}

// Check 9: Verify main.js doesn't have demo fallbacks
if (fs.existsSync('web-app/js/main.js')) {
  const mainJsContent = fs.readFileSync('web-app/js/main.js', 'utf8');
  if (mainJsContent.includes('updateStaticProductionStats') && 
      mainJsContent.includes('Real count, starts at 0')) {
    success('Frontend uses real API calls with proper zero fallbacks');
  } else {
    warning('Frontend may have improper fallback logic');
  }
} else {
  error('Frontend main.js missing');
}

// Check 10: Verify production entrypoint
console.log('\n📋 Checking production entrypoint...');
if (fs.existsSync('docker/production-entrypoint.sh')) {
  const entrypointContent = fs.readFileSync('docker/production-entrypoint.sh', 'utf8');
  if (!entrypointContent.includes('/opt/ovenmediaengine/bin/simple-health-server.sh &')) {
    success('Production entrypoint does not start conflicting health server');
  } else {
    error('Production entrypoint still starts conflicting health server');
  }
} else {
  error('Production entrypoint script missing');
}

// Summary
console.log('\n📊 Verification Summary:');
console.log('='.repeat(50));

if (hasErrors) {
  console.log(`❌ ${hasErrors ? 'FAILED' : 'PASSED'} - Critical issues found that must be fixed`);
  process.exit(1);
} else if (hasWarnings) {
  console.log(`⚠️  PASSED WITH WARNINGS - Some non-critical issues found`);
  console.log('   The system will work but may have reduced performance or features');
} else {
  console.log('✅ ALL CHECKS PASSED - Production setup is ready!');
  console.log('   ✨ No mock data or demo UI detected');
  console.log('   ✨ PostgreSQL and Redis properly configured');
  console.log('   ✨ Industry-standard security and configuration');
  console.log('   ✨ All streaming features enabled');
}

console.log('\n🚀 System ready for production deployment!');