#!/usr/bin/env node
/**
 * Custom migration runner with better connection handling
 */

const knex = require('knex');

const config = {
  client: 'pg',
  connection: {
    host: 'localhost',
    user: 'cruvz',
    password: 'cruvzSRT91',
    database: 'cruvzdb',
    port: 5432,
  },
  pool: {
    min: 1,
    max: 2,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 15000,
    destroyTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
  },
  migrations: {
    directory: './scripts/migrations'
  },
  acquireConnectionTimeout: 30000
};

async function runMigrations() {
  const db = knex(config);
  
  try {
    console.log('🔄 Testing database connection...');
    await db.raw('SELECT 1');
    console.log('✅ Database connection successful');
    
    console.log('🔄 Running migrations...');
    const [batchNo, migrations] = await db.migrate.latest();
    
    if (migrations.length === 0) {
      console.log('✅ No new migrations to run');
    } else {
      console.log(`✅ Batch ${batchNo} run: ${migrations.length} migrations`);
      migrations.forEach(migration => {
        console.log(`  - ${migration}`);
      });
    }
    
    console.log('🔄 Checking table structure...');
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('✅ Database tables created:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  runMigrations().catch(error => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };