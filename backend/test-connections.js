// Test database and cache connections
require('dotenv').config();

async function testConnections() {
  console.log('Testing database connection...');
  try {
    const db = require('./config/database');
    await db.raw('SELECT 1');
    console.log('✅ Database connection successful');
    await db.destroy();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }

  console.log('Testing cache connection...');
  try {
    const cache = require('./utils/cache');
    await cache.init();
    await cache.connect();
    console.log('✅ Cache connection successful');
    await cache.disconnect();
  } catch (error) {
    console.error('❌ Cache connection failed:', error.message);
  }
}

testConnections().catch(console.error);