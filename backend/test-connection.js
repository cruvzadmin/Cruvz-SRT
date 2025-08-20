// Test PostgreSQL connection directly
const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    host: 'localhost',
    user: 'cruvz',
    password: 'cruvzpass',
    database: 'cruvzdb',
    port: 5432,
  });

  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT version()');
    console.log('✅ PostgreSQL version:', result.rows[0].version);
    
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('✅ Created uuid extension');
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
  } finally {
    await client.end();
    console.log('✅ Connection closed');
  }
}

testConnection();