const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Production-grade database configuration with SQLite/PostgreSQL flexibility
const isProduction = process.env.NODE_ENV === 'production';
const usePostgres = process.env.USE_POSTGRES === 'true' || process.env.DATABASE_URL?.includes('postgres');

// Ensure directories exist (only for SQLite)
const dataDir = path.join(__dirname, '../data');
const dbDir = path.join(dataDir, 'database');
const logsDir = path.join(dataDir, 'logs');

// Only create directories if we're using SQLite
if (!usePostgres) {
  [dataDir, dbDir, logsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

let config;

if (isProduction && usePostgres) {
  // Production PostgreSQL with connection pooling and optimization
  config = {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: process.env.POSTGRES_HOST || 'postgres',
      user: process.env.POSTGRES_USER || 'cruvz',
      password: process.env.POSTGRES_PASSWORD || 'cruvzpass',
      database: process.env.POSTGRES_DB || 'cruvzdb',
      port: process.env.POSTGRES_PORT || 5432,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
      // Production-optimized connection pool for high concurrency
      min: 10,
      max: 100,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 300000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false
    },
    migrations: {
      directory: path.join(__dirname, '../scripts/migrations')
    },
    seeds: {
      directory: path.join(__dirname, '../scripts/seeds')
    },
    acquireConnectionTimeout: 60000,
    asyncStackTraces: false // Disable for production performance
  };
} else if (isProduction) {
  // Production SQLite configuration
  config = {
    client: 'sqlite3',
    connection: {
      filename: path.join(dbDir, 'cruvz_production.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, '../scripts/migrations')
    },
    seeds: {
      directory: path.join(__dirname, '../scripts/seeds')
    },
    pool: {
      min: 5,
      max: 20,
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
        conn.run('PRAGMA journal_mode = WAL', cb);
        conn.run('PRAGMA synchronous = NORMAL', cb);
        conn.run('PRAGMA cache_size = 1000', cb);
        conn.run('PRAGMA temp_store = memory', cb);
      }
    }
  };
} else if (usePostgres) {
  // Development PostgreSQL with basic pooling
  config = {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST || 'localhost',
      user: process.env.POSTGRES_USER || 'cruvz',
      password: process.env.POSTGRES_PASSWORD || 'cruvzpass',
      database: process.env.POSTGRES_DB || 'cruvzdb',
      port: process.env.POSTGRES_PORT || 5432,
    },
    migrations: {
      directory: path.join(__dirname, '../scripts/migrations')
    },
    seeds: {
      directory: path.join(__dirname, '../scripts/seeds')
    },
    pool: { min: 2, max: 20 }
  };
} else {
  // Development SQLite
  config = {
    client: 'sqlite3',
    connection: {
      filename: path.join(dbDir, 'cruvz_development.db')
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, '../scripts/migrations')
    },
    seeds: {
      directory: path.join(__dirname, '../scripts/seeds')
    },
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  };
}

const db = knex(config);

module.exports = db;
