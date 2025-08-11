const knex = require('knex');
const path = require('path');
const fs = require('fs');

// Determine database configuration based on environment
const databaseUrl = process.env.DATABASE_URL;

let config;

if (databaseUrl && databaseUrl.endsWith('.db')) {
  // SQLite configuration for production
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
  // PostgreSQL configuration for development
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
    pool: { min: 2, max: 10 }
  };
}

const db = knex(config);

module.exports = db;
