// Test direct database connection
require('dotenv').config();

async function testDB() {
  try {
    const knex = require('knex');
    const db = knex({
      client: 'pg',
      connection: {
        host: 'localhost',
        user: 'cruvz',
        password: 'cruvzSRT91',
        database: 'cruvzdb',
        port: 5432,
      },
      pool: { min: 1, max: 2, acquireTimeoutMillis: 5000 }
    });
    
    console.log('Testing basic connection...');
    await db.raw('SELECT 1');
    console.log('✅ Basic connection works');
    
    console.log('Testing users table...');
    const users = await db('users').select('email', 'role').limit(5);
    console.log('✅ Users found:', users);
    
    console.log('Testing login simulation...');
    const user = await db('users').where('email', 'demo@cruvz.com').first();
    if (user) {
      console.log('✅ Demo user found:', { email: user.email, role: user.role });
    } else {
      console.log('❌ Demo user not found');
    }
    
    await db.destroy();
    console.log('✅ Connection test completed successfully');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

testDB();