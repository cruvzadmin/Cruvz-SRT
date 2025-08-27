#!/usr/bin/env node
/**
 * Custom migration runner with better connection handling
 * Improved: clearer error output, process exit code, and migration summary.
 */

const knex = require('knex');

const config = {
  client: 'pg',
  connection: {
    host: process.env.POSTGRES_HOST || 'postgres', // Use Docker Compose service name
    user: process.env.POSTGRES_USER || 'cruvz',
    password: process.env.POSTGRES_PASSWORD || 'cruvzSRT91',
    database: process.env.POSTGRES_DB || 'cruvzdb',
    port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT) : 5432,
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
  let migrationError = null;

  try {
    console.log('🔄 Testing database connection...');
    await db.raw('SELECT 1');
    console.log('✅ Database connection successful');

    console.log('🔄 Running custom migration...');
    
    // Use our custom migration script
    const migrate = require('./scripts/migrate');
    await migrate();
    
    console.log('✅ Custom migration completed successfully');

    // Table summary
    console.log('🔄 Checking table structure...');
    const tables = await db.raw(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tables.rows && tables.rows.length > 0) {
      console.log('✅ Database tables present:');
      tables.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.warn('⚠️  No tables found in the public schema.');
    }

  } catch (error) {
    migrationError = error;
    console.error('❌ Migration failed:', error && error.message ? error.message : error);
    if (error && error.stack) {
      console.error(error.stack);
    }
  } finally {
    await db.destroy();
    if (migrationError) process.exit(1);
  }
}

if (require.main === module) {
  runMigrations().catch(error => {
    // Fallback for any unexpected promise rejection
    console.error('💥 Migration script failed:', error && error.message ? error.message : error);
    if (error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = { runMigrations };
