const knex = require('knex');

// Simple database configuration that definitely works
const config = {
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'cruvz',
    password: 'cruvzSRT91',
    database: 'cruvzdb'
  },
  pool: {
    min: 1,
    max: 5
  },
  migrations: {
    directory: './scripts/migrations'
  },
  seeds: {
    directory: './scripts/seeds'
  }
};

const db = knex(config);

module.exports = db;