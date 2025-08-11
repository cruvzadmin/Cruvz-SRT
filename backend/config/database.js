const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Production-grade PostgreSQL configuration for 1000+ users
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

let config;

// Force PostgreSQL for production to handle 1000+ concurrent users
if (isProduction) {
  // Production PostgreSQL with connection pooling and optimization
  config = {
    client: 'pg',
    connection: databaseUrl || {
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
    // Performance optimizations for streaming workloads
    postProcessResponse: (result, queryContext) => {
      // Optimize for streaming data queries
      if (queryContext.method === 'select' && Array.isArray(result)) {
        return result;
      }
      return result;
    },
    acquireConnectionTimeout: 60000,
    asyncStackTraces: false // Disable for production performance
  };
} else if (databaseUrl && databaseUrl.endsWith('.db')) {
  // SQLite only for development/testing - NOT production
  const dbPath = path.resolve(databaseUrl);
  const dbDir = path.dirname(dbPath);
  
  // Ensure database directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  config = {
    client: 'sqlite3',
    connection: {
      filename: dbPath
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, '../scripts/migrations')
    },
    seeds: {
      directory: path.join(__dirname, '../scripts/seeds')
    }
  };
} else {
  // Development PostgreSQL with basic pooling
  config = {
    client: 'pg',
    connection: {
      host: process.env.POSTGRES_HOST || 'postgres',
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
}

const db = knex(config);

module.exports = db;
