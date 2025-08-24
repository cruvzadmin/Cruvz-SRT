module.exports = {
  apps: [
    {
      name: 'cruvz-srt-backend',
      script: './backend/server.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Performance and monitoring
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 5,
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Health monitoring
      listen_timeout: 8000,
      kill_timeout: 5000,
      
      // Auto restart on file changes (development only)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'recordings'],
      
      // Advanced PM2 features
      source_map_support: true,
      merge_logs: true,
      
      // Environment-specific configuration
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 5001
      }
    }
  ],

  // PM2 deploy configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/cruvzadmin/Cruvz-SRT.git',
      path: '/var/www/cruvz-srt',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && cd backend && npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};