#!/usr/bin/env node
/**
 * Production data seeding script
 * Creates realistic sample data for production deployment
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./config/database');

async function seedProductionData() {
  try {
    console.log('🌱 Starting production data seeding...');

    // Check if data already exists
    const existingUsers = await db('users').count('id as count').first();
    if (existingUsers.count > 0) {
      console.log('✅ Database already has data. Skipping seed.');
      return;
    }

    // Create admin user
    const adminPassword = process.env.ADMIN_PASSWORD || 'Adm1n_Test_2025!_Qx7R$$gL3';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@cruvzstreaming.com';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, 12);
    
    const adminId = uuidv4();
    
    await db('users').insert({
      id: adminId,
      email: adminEmail,
      password_hash: hashedAdminPassword,
      first_name: 'System',
      last_name: 'Administrator',
      role: 'admin',
      is_active: true,
      email_verified: true,
      max_streams: 1000,
      max_viewers_per_stream: 100000,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });
    console.log(`✅ Created admin user: ${adminEmail}`);

    // Create demo users for testing
    const demoUsers = [
      {
        email: 'demo.streamer@cruvz.com',
        firstName: 'Demo',
        lastName: 'Streamer',
        role: 'streamer',
        password: 'Demo123!_Stream'
      },
      {
        email: 'test.user@cruvz.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'user',
        password: 'TestUser123!'
      }
    ];

    const userIds = [];
    for (const user of demoUsers) {
      const hashedPassword = await bcrypt.hash(user.password, 12);
      const userId = uuidv4();
      userIds.push(userId);
      
      await db('users').insert({
        id: userId,
        email: user.email,
        password_hash: hashedPassword,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role,
        is_active: true,
        email_verified: true,
        max_streams: user.role === 'streamer' ? 10 : 5,
        max_viewers_per_stream: user.role === 'streamer' ? 10000 : 1000,
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
      console.log(`✅ Created ${user.role}: ${user.email}`);
    }

    // Create sample streams for the demo streamer
    const streamerId = userIds[0]; // Demo streamer
    const sampleStreams = [
      {
        title: 'Live Gaming Stream - Call of Duty',
        description: 'Professional gameplay with commentary and viewer interaction',
        protocol: 'rtmp',
        status: 'active',
        currentViewers: 847,
        peakViewers: 1250
      },
      {
        title: 'Music Production Live',
        description: 'Creating beats and mixing tracks live',
        protocol: 'webrtc',
        status: 'active',
        currentViewers: 234,
        peakViewers: 456
      },
      {
        title: 'Tech Talk - Latest Web Technologies',
        description: 'Discussion about React, Node.js, and modern web development',
        protocol: 'srt',
        status: 'ended',
        currentViewers: 0,
        peakViewers: 892
      }
    ];

    const streamIds = [];
    for (const stream of sampleStreams) {
      const streamKey = `stream_${uuidv4().replace(/-/g, '')}`;
      const streamId = uuidv4();
      streamIds.push(streamId);
      
      await db('streams').insert({
        id: streamId,
        user_id: streamerId,
        title: stream.title,
        description: stream.description,
        stream_key: streamKey,
        protocol: stream.protocol,
        source_url: `rtmp://origin:1935/live/${streamKey}`,
        destination_url: '',
        status: stream.status,
        settings: JSON.stringify({
          quality: '1080p',
          bitrate: 5000,
          fps: 30,
          audio_bitrate: 128
        }),
        max_viewers: 10000,
        current_viewers: stream.currentViewers,
        peak_viewers: stream.peakViewers,
        is_recording: stream.status === 'active',
        started_at: stream.status === 'ended' ? 
          new Date(Date.now() - 3 * 60 * 60 * 1000) : // Ended 3 hours ago
          new Date(Date.now() - 2 * 60 * 60 * 1000),   // Started 2 hours ago
        ended_at: stream.status === 'ended' ? 
          new Date(Date.now() - 1 * 60 * 60 * 1000) : null, // Ended 1 hour ago
        created_at: db.fn.now(),
        updated_at: db.fn.now()
      });
      console.log(`✅ Created stream: ${stream.title} (${stream.status})`);
    }

    // Create analytics data for streams
    const today = new Date();
    for (const streamId of streamIds) {
      // Create analytics for the last 7 days
      for (let i = 0; i < 7; i++) {
        const analyticsDate = new Date(today);
        analyticsDate.setDate(today.getDate() - i);
        
        await db('stream_analytics').insert({
          id: uuidv4(),
          stream_id: streamId,
          date: analyticsDate.toISOString().split('T')[0],
          unique_viewers: Math.floor(Math.random() * 500) + 100,
          total_views: Math.floor(Math.random() * 1000) + 200,
          peak_concurrent_viewers: Math.floor(Math.random() * 800) + 200,
          total_watch_time: Math.floor(Math.random() * 50000) + 10000,
          avg_watch_duration: Math.random() * 300 + 60,
          geographic_data: JSON.stringify({
            'United States': 45,
            'Canada': 20,
            'United Kingdom': 15,
            'Germany': 10,
            'Others': 10
          }),
          device_data: JSON.stringify({
            'Desktop': 60,
            'Mobile': 30,
            'Tablet': 10
          }),
          quality_metrics: JSON.stringify({
            avgBitrate: Math.floor(Math.random() * 2000) + 3000,
            avgLatency: Math.floor(Math.random() * 50) + 50,
            qualityScore: Math.random() * 20 + 80
          }),
          created_at: db.fn.now(),
          updated_at: db.fn.now()
        });
      }
    }
    console.log('✅ Created analytics data for streams');

    // Create Six Sigma metrics
    const metricTypes = ['latency', 'cpu_usage', 'memory_usage', 'disk_usage', 'throughput'];
    for (let i = 0; i < 100; i++) {
      for (const metricType of metricTypes) {
        let value, target;
        switch (metricType) {
        case 'latency':
          value = Math.random() * 50 + 50; // 50-100ms
          target = 75;
          break;
        case 'cpu_usage':
          value = Math.random() * 80 + 10; // 10-90%
          target = 70;
          break;
        case 'memory_usage':
          value = Math.random() * 70 + 20; // 20-90%
          target = 80;
          break;
        case 'disk_usage':
          value = Math.random() * 50 + 30; // 30-80%
          target = 85;
          break;
        case 'throughput':
          value = Math.random() * 1000 + 2000; // 2000-3000 requests/sec
          target = 2500;
          break;
        }

        const metricsDate = new Date(Date.now() - i * 2 * 60 * 1000); // Every 2 minutes
        
        await db('six_sigma_metrics').insert({
          id: uuidv4(),
          metric_name: metricType,
          metric_type: 'performance',
          value,
          target,
          sigma_level: value <= target ? 4.5 + Math.random() * 1.5 : 2.5 + Math.random() * 2,
          date: metricsDate.toISOString().split('T')[0],
          created_at: metricsDate,
          updated_at: metricsDate
        });
      }
    }
    console.log('✅ Created Six Sigma metrics data');

    console.log('\n🎉 Production data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   👤 Admin: ${adminEmail} / ${adminPassword}`);
    console.log('   👤 Demo Streamer: demo.streamer@cruvz.com / Demo123!_Stream');
    console.log('   👤 Test User: test.user@cruvz.com / TestUser123!');
    console.log(`   📺 Active Streams: 2 live streams with ${847 + 234} total viewers`);
    console.log('   📈 Analytics: 7 days of stream analytics data');
    console.log('   📊 Metrics: 100 data points for Six Sigma monitoring');
    console.log('\n⚠️  IMPORTANT: Change default passwords in production!');

  } catch (error) {
    console.error('❌ Production data seeding failed:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  seedProductionData().catch(error => {
    console.error('💥 Seeding script failed:', error);
    process.exit(1);
  });
}

module.exports = { seedProductionData };