const db = require('./config/database.js');
const knex = db;

console.log('Creating uuid extension...');
knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"').then(() => {
  console.log('UUID extension created successfully');
  
  console.log('Checking if users table exists...');
  return knex.schema.hasTable('users');
}).then(exists => {
  console.log('Users table exists:', exists);
  if (!exists) {
    console.log('Creating users table...');
    return knex.schema.createTable('users', table => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('email', 255).notNullable().unique();
      table.string('password_hash', 255).notNullable();
      table.string('first_name', 100);
      table.string('last_name', 100);
      table.string('role').defaultTo('user');
      table.boolean('is_active').defaultTo(true);
      table.boolean('email_verified').defaultTo(false);
      table.string('avatar_url', 500);
      table.integer('max_streams').defaultTo(5);
      table.integer('max_viewers_per_stream').defaultTo(1000);
      table.timestamp('last_login_at');
      table.timestamps(true, true);
      table.index(['email']);
      table.index(['role']);
      table.index(['is_active']);
      table.index(['created_at']);
    });
  }
}).then(() => {
  console.log('Users table creation completed');
  return knex.destroy();
}).catch(err => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  knex.destroy();
});