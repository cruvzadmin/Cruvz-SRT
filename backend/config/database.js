const knex = require('knex');
const path = require('path');

const config = {
  client: 'sqlite3',
  connection: {
    filename: process.env.DATABASE_URL || path.join(__dirname, '../data/cruvz_streaming.db')
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

const db = knex(config);

module.exports = db;