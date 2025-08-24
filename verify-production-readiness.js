#!/usr/bin/env node
/**
 * Final production readiness verification script
 * Comprehensive check before going live
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function verifyProductionReadiness() {
  console.log('🎯 CRUVZ-SRT PRODUCTION READINESS VERIFICATION');
  console.log('=' .repeat(60));
  
  let checks = {
    passed: 0,
    failed: 0,
    warnings: 0
  };

  // 1. Environment Configuration
  console.log('\n1. 🔧 Environment Configuration');
  const requiredVars = [
    'NODE_ENV', 'POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 
    'POSTGRES_DB', 'REDIS_HOST', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'
  ];
  
  let envIssues = [];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      envIssues.push(varName);
    }
  }
  
  if (envIssues.length === 0) {
    console.log('   ✅ All required environment variables present');
    checks.passed++;
  } else {
    console.log(`   ❌ Missing environment variables: ${envIssues.join(', ')}`);
    checks.failed++;
  }

  // Check for default passwords
  const defaultPasswords = [
    'CHANGE_THIS_PASSWORD',
    'password123',
    'admin123',
    'changeme'
  ];
  
  let passwordWarnings = [];
  if (defaultPasswords.some(pwd => process.env.ADMIN_PASSWORD?.includes(pwd))) {
    passwordWarnings.push('ADMIN_PASSWORD appears to be default');
  }
  if (process.env.JWT_SECRET?.length < 32) {
    passwordWarnings.push('JWT_SECRET should be at least 32 characters');
  }
  
  if (passwordWarnings.length > 0) {
    console.log(`   ⚠️  Security warnings: ${passwordWarnings.join(', ')}`);
    checks.warnings++;
  }

  // 2. File Structure
  console.log('\n2. 📁 File Structure');
  const criticalFiles = [
    'backend/server.js',
    'backend/config/database.js',
    'backend/utils/cache.js',
    'backend/routes/analytics.js',
    'backend/routes/streams.js',
    'web-app/index.html',
    'web-app/js/main.js',
    'ecosystem.config.js'
  ];
  
  let missingFiles = [];
  for (const file of criticalFiles) {
    if (!fs.existsSync(path.join(__dirname, file))) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length === 0) {
    console.log('   ✅ All critical files present');
    checks.passed++;
  } else {
    console.log(`   ❌ Missing files: ${missingFiles.join(', ')}`);
    checks.failed++;
  }

  // 3. Database Configuration
  console.log('\n3. 🐘 Database Configuration');
  try {
    const dbConfigPath = './backend/config/database.js';
    if (fs.existsSync(path.join(__dirname, dbConfigPath))) {
      const dbConfig = require(dbConfigPath);
      // Check if it's a knex instance or config object
      if (dbConfig && (dbConfig.client === 'pg' || (dbConfig.client && dbConfig.client.config && dbConfig.client.config.client === 'pg'))) {
        console.log('   ✅ PostgreSQL configuration loaded');
        checks.passed++;
      } else {
        console.log('   ❌ Invalid database configuration');
        checks.failed++;
      }
    } else {
      console.log('   ❌ Database configuration file missing');
      checks.failed++;
    }
  } catch (error) {
    console.log(`   ❌ Database configuration error: ${error.message}`);
    checks.failed++;
  }

  // 4. Cache Configuration
  console.log('\n4. 🔴 Cache Configuration');
  try {
    const cacheConfig = require('./backend/utils/cache');
    if (cacheConfig) {
      console.log('   ✅ Redis cache configuration loaded');
      checks.passed++;
    } else {
      console.log('   ❌ Invalid cache configuration');
      checks.failed++;
    }
  } catch (error) {
    console.log(`   ❌ Cache configuration error: ${error.message}`);
    checks.failed++;
  }

  // 5. Frontend-Backend Integration
  console.log('\n5. 🌐 Frontend-Backend Integration');
  const mainJs = fs.readFileSync('./web-app/js/main.js', 'utf8');
  if (mainJs.includes('API_BASE_URL') && mainJs.includes('localhost:5000')) {
    console.log('   ✅ Frontend API configuration present');
    checks.passed++;
  } else {
    console.log('   ❌ Frontend API configuration missing');
    checks.failed++;
  }

  // 6. Production Scripts
  console.log('\n6. 📋 Production Scripts');
  const productionScripts = [
    'backend/setup-db.js',
    'backend/run-migrations.js', 
    'backend/seed-production-data.js',
    'backend/test-production-config.js'
  ];
  
  let scriptsPresent = 0;
  for (const script of productionScripts) {
    if (fs.existsSync(path.join(__dirname, script))) {
      scriptsPresent++;
    }
  }
  
  if (scriptsPresent === productionScripts.length) {
    console.log('   ✅ All production scripts present');
    checks.passed++;
  } else {
    console.log(`   ❌ Missing production scripts: ${productionScripts.length - scriptsPresent}`);
    checks.failed++;
  }

  // 7. Development Artifacts (should be removed)
  console.log('\n7. 🧹 Development Artifacts');
  const devFiles = [
    'backend/config/database-dev.js',
    'backend/config/database-simple.js',
    'backend/utils/cache-dev.js'
  ];
  
  let devFilesFound = [];
  for (const file of devFiles) {
    if (fs.existsSync(path.join(__dirname, file))) {
      devFilesFound.push(file);
    }
  }
  
  if (devFilesFound.length === 0) {
    console.log('   ✅ No development artifacts found');
    checks.passed++;
  } else {
    console.log(`   ⚠️  Development files still present: ${devFilesFound.join(', ')}`);
    checks.warnings++;
  }

  // Final Results
  console.log('\n' + '='.repeat(60));
  console.log('🎯 PRODUCTION READINESS SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Checks Passed: ${checks.passed}`);
  console.log(`❌ Checks Failed: ${checks.failed}`);
  console.log(`⚠️  Warnings: ${checks.warnings}`);
  
  const totalChecks = checks.passed + checks.failed;
  const successRate = Math.round((checks.passed / totalChecks) * 100);
  console.log(`📊 Success Rate: ${successRate}%`);

  if (checks.failed === 0) {
    console.log('\n🎉 PRODUCTION READY!');
    console.log('\nNext steps:');
    console.log('1. Set up PostgreSQL and Redis infrastructure');
    console.log('2. Run: cd backend && node setup-db.js');
    console.log('3. Run: cd backend && node run-migrations.js');
    console.log('4. Run: cd backend && node seed-production-data.js');
    console.log('5. Test: cd backend && node test-production-config.js');
    console.log('6. Deploy: pm2 start ecosystem.config.js --env production');
    
    if (checks.warnings > 0) {
      console.log('\n⚠️  Address warnings before production deployment');
    }
    
    return true;
  } else {
    console.log('\n💥 NOT READY FOR PRODUCTION');
    console.log(`Please fix ${checks.failed} failed checks before deployment.`);
    return false;
  }
}

if (require.main === module) {
  verifyProductionReadiness().catch(error => {
    console.error('💥 Verification failed:', error);
    process.exit(1);
  });
}

module.exports = { verifyProductionReadiness };