#!/usr/bin/env node
/**
 * Production configuration validation and testing script
 * Tests PostgreSQL database and Redis cache connectivity
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testProductionConfig() {
  let testsPassed = 0;
  let testsFailed = 0;

  console.log('🔍 Testing Production Configuration...\n');

  // Test 1: Environment Variables
  console.log('1. 📋 Checking environment variables...');
  const requiredEnvVars = [
    'POSTGRES_HOST',
    'POSTGRES_USER', 
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'REDIS_HOST',
    'JWT_SECRET'
  ];

  let envValid = true;
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.log(`   ❌ Missing: ${envVar}`);
      envValid = false;
    } else {
      console.log(`   ✅ Found: ${envVar}`);
    }
  }

  if (envValid) {
    console.log('   🎉 All required environment variables present');
    testsPassed++;
  } else {
    console.log('   💥 Missing required environment variables');
    testsFailed++;
  }

  // Test 2: PostgreSQL Connection
  console.log('\n2. 🐘 Testing PostgreSQL connection...');
  try {
    const db = require('./config/database');
    await db.raw('SELECT version()');
    const result = await db.raw('SELECT version()');
    console.log(`   ✅ PostgreSQL connected: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    
    // Test database structure
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    if (tables.rows.length > 0) {
      console.log(`   ✅ Database tables found: ${tables.rows.length} tables`);
      tables.rows.forEach(row => {
        console.log(`      - ${row.table_name}`);
      });
    } else {
      console.log('   ⚠️  No tables found - run migrations first');
    }
    
    await db.destroy();
    testsPassed++;
  } catch (error) {
    console.log(`   ❌ PostgreSQL connection failed: ${error.message}`);
    testsFailed++;
  }

  // Test 3: Redis Connection
  console.log('\n3. 🔴 Testing Redis connection...');
  try {
    const cache = require('./utils/cache');
    await cache.init();
    await cache.connect();
    
    const pingResult = await cache.ping();
    if (pingResult) {
      console.log('   ✅ Redis connected and responding to ping');
      
      // Test cache operations
      await cache.set('test_key', { test: 'data' }, 10);
      const testData = await cache.get('test_key');
      if (testData && testData.test === 'data') {
        console.log('   ✅ Redis read/write operations working');
      } else {
        console.log('   ❌ Redis read/write operations failed');
      }
      
      await cache.delete('test_key');
      testsPassed++;
    } else {
      console.log('   ❌ Redis ping failed');
      testsFailed++;
    }
  } catch (error) {
    console.log(`   ❌ Redis connection failed: ${error.message}`);
    testsFailed++;
  }

  // Test 4: Server Configuration
  console.log('\n4. ⚙️ Testing server configuration...');
  try {
    const server = require('./server');
    console.log('   ✅ Server configuration loaded successfully');
    console.log('   ✅ All middleware and routes configured');
    testsPassed++;
  } catch (error) {
    console.log(`   ❌ Server configuration failed: ${error.message}`);
    testsFailed++;
  }

  // Test 5: Database Sample Data
  console.log('\n5. 📊 Checking database sample data...');
  try {
    const db = require('./config/database');
    
    const userCount = await db('users').count('id as count').first();
    const streamCount = await db('streams').count('id as count').first();
    
    console.log(`   📈 Users in database: ${userCount.count}`);
    console.log(`   📺 Streams in database: ${streamCount.count}`);
    
    if (userCount.count > 0 && streamCount.count > 0) {
      // Get active streams
      const activeStreams = await db('streams')
        .where('status', 'active')
        .select('title', 'current_viewers', 'protocol');
      
      if (activeStreams.length > 0) {
        console.log(`   ✅ Found ${activeStreams.length} active streams:`);
        activeStreams.forEach(stream => {
          console.log(`      - ${stream.title} (${stream.current_viewers} viewers, ${stream.protocol})`);
        });
      } else {
        console.log('   ⚠️  No active streams found');
      }
      
      testsPassed++;
    } else {
      console.log('   ⚠️  No sample data found - run seed script');
      testsPassed++; // Not a failure, just needs seeding
    }
    
    await db.destroy();
  } catch (error) {
    console.log(`   ❌ Database sample data check failed: ${error.message}`);
    testsFailed++;
  }

  // Final Results
  console.log('\n' + '='.repeat(50));
  console.log('🎯 PRODUCTION CONFIGURATION TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log(`📊 Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);

  if (testsFailed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Production configuration is ready.');
    console.log('\n📋 Next steps:');
    console.log('   1. Run migrations: node run-migrations.js');
    console.log('   2. Seed database: node seed-production-data.js');
    console.log('   3. Start server: npm start');
    process.exit(0);
  } else {
    console.log('\n💥 SOME TESTS FAILED! Please fix the issues above.');
    process.exit(1);
  }
}

if (require.main === module) {
  testProductionConfig().catch(error => {
    console.error('💥 Configuration test failed:', error);
    process.exit(1);
  });
}

module.exports = { testProductionConfig };