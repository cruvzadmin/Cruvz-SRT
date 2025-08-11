/**
 * Production seed data for streaming platform
 * Creates optimized data for 1000+ user deployment
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('notifications').del()
    .then(() => knex('stream_analytics').del())
    .then(() => knex('stream_sessions').del())
    .then(() => knex('streams').del())
    .then(() => knex('api_keys').del())
    .then(() => knex('users').del())
    .then(async () => {
      // Create production admin user
      const adminPassword = process.env.ADMIN_PASSWORD || 'CHANGE_THIS_PASSWORD_changeme123!';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@cruvzstreaming.com';
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const adminId = uuidv4();
      
      // Insert admin user
      await knex('users').insert({
        id: adminId,
        email: adminEmail,
        password_hash: hashedPassword,
        first_name: 'System',
        last_name: 'Administrator',
        role: 'admin',
        is_active: true,
        email_verified: true,
        max_streams: 1000,
        max_viewers_per_stream: 100000,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });

      // Create demo streamer user for testing
      const streamerPassword = await bcrypt.hash('demo123!', 12);
      const streamerId = uuidv4();
      
      await knex('users').insert({
        id: streamerId,
        email: 'demo@cruvzstreaming.com',
        password_hash: streamerPassword,
        first_name: 'Demo',
        last_name: 'Streamer',
        role: 'streamer',
        is_active: true,
        email_verified: true,
        max_streams: 10,
        max_viewers_per_stream: 10000,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });

      // Create demo API key for testing
      const apiKeyHash = await bcrypt.hash('demo_api_key_12345', 10);
      
      await knex('api_keys').insert({
        id: uuidv4(),
        user_id: streamerId,
        key_hash: apiKeyHash,
        name: 'Demo Streaming API Key',
        permissions: JSON.stringify(['streams:create', 'streams:read', 'streams:update', 'streams:delete']),
        is_active: true,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });

      // Create demo stream for testing
      const streamKey = `stream_${uuidv4().replace(/-/g, '')}`;
      
      await knex('streams').insert({
        id: uuidv4(),
        user_id: streamerId,
        title: 'Demo Live Stream',
        description: 'Demonstration stream for testing the platform with 1000+ users',
        stream_key: streamKey,
        protocol: 'rtmp',
        source_url: `rtmp://origin:1935/live/${streamKey}`,
        destination_url: '',
        status: 'inactive',
        settings: JSON.stringify({
          quality: '1080p',
          bitrate: 5000,
          fps: 30,
          audio_bitrate: 128
        }),
        max_viewers: 10000,
        current_viewers: 0,
        is_recording: false,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });

      console.log('\n✅ Production seed data created successfully!');
      console.log('📧 Admin email:', adminEmail);
      console.log('🔑 Admin password:', adminPassword);
      console.log('📺 Demo streamer: demo@cruvzstreaming.com / demo123!');
      console.log('🔗 Demo stream key:', streamKey);
      console.log('\n⚠️  REMEMBER: Change default passwords in production!');
    });
};