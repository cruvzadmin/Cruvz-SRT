// Production-ready Knex configuration with SQLite/PostgreSQL flexibility
require('dotenv').config();
const path = require('path');

// Auto-detect database type based on environment
const usePostgres = process.env.USE_POSTGRES === 'true' || process.env.DATABASE_URL?.includes('postgres');

// Ensure directories exist
const fs = require('fs');
const dataDir = path.join(__dirname, '../data');
const dbDir = path.join(dataDir, 'database');
const logsDir = path.join(dataDir, 'logs');

[dataDir, dbDir, logsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const config = {
  development: usePostgres ? {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST || 'localhost',
      user: process.env.POSTGRES_USER || 'cruvz',
      password: process.env.POSTGRES_PASSWORD || 'cruvzpass',
      database: process.env.POSTGRES_DB || 'cruvzdb',
      port: process.env.POSTGRES_PORT || 5432,
    },
    migrations: {
      directory: './scripts/migrations'
    },
    seeds: {
      directory: './scripts/seeds'
    },
    pool: { min: 2, max: 20 }
  } : {
    client: 'sqlite3',
    connection: {
      filename: path.join(dbDir, 'cruvz_development.db')
    },
    migrations: {
      directory: './scripts/migrations'
    },
    seeds: {
      directory: './scripts/seeds'
    },
    useNullAsDefault: true,
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  },

  production: usePostgres ? {
    client: 'pg',
    connection: process.env.DATABASE_URL || {
      host: process.env.POSTGRES_HOST || 'postgres',
      user: process.env.POSTGRES_USER || 'cruvz',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || 'cruvzdb',
      port: process.env.POSTGRES_PORT || 5432,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
    },
    pool: {
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
      directory: './scripts/migrations'
    },
    seeds: {
      directory: './scripts/seeds'
    },
    acquireConnectionTimeout: 60000,
    asyncStackTraces: false
  } : {
    client: 'sqlite3',
    connection: {
      filename: path.join(dbDir, 'cruvz_production.db')
    },
    migrations: {
      directory: './scripts/migrations'
    },
    seeds: {
      directory: './scripts/seeds'
    },
    useNullAsDefault: true,
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
  }
};

module.exports = config;