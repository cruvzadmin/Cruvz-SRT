// Production-ready Knex configuration for PostgreSQL
require('dotenv').config();

const config = {
  development: {
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
  },

  production: {
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
  }
};

module.exports = config;