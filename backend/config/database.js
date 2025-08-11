const knex = require('knex');
const path = require('path');

const config = {
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

const db = knex(config);

module.exports = db;
