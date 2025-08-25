const Redis = require('ioredis');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    // Removed memory fallback for production-ready deployment
  }

  async init() {
    try {
      // Redis is REQUIRED for production deployment - no fallback allowed
      const redisHost = process.env.REDIS_HOST;
      if (!redisHost) {
        const error = 'REDIS_HOST environment variable is required for production deployment';
        logger.error(error);
        throw new Error(error);
      }

      const redisConfig = {
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableAutoPipelining: true,
        keepAlive: 30000,
        family: 4,
        // Production optimizations for 1000+ users
        connectTimeout: 10000,
        commandTimeout: 5000,
        maxLoadingTimeout: 10000,
        db: 0
      };

      this.redis = new Redis(redisConfig);

      this.redis.on('connect', () => {
        logger.info('Redis cache connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (err) => {
        logger.error('Redis cache connection error:', err.message);
        this.isConnected = false;
        // In production deployment, Redis failures are critical and should stop the server
        throw new Error(`Redis connection failed: ${err.message}`);
      });

      this.redis.on('close', () => {
        logger.error('Redis cache connection closed');
        this.isConnected = false;
        throw new Error('Redis connection lost - production deployment requires Redis');
      });

    } catch (error) {
      logger.error('Failed to initialize Redis cache:', error.message);
      this.isConnected = false;
      // Redis is mandatory for production deployment
      throw error;
    }
  }

  // Connect to Redis with proper error handling
  async connect() {
    try {
      if (!this.redis) {
        throw new Error('Redis not initialized');
      }
      
      // For ioredis with lazyConnect: true, we need to trigger a command to connect
      await this.redis.ping();
      logger.info('✅ Redis cache connected successfully');
      this.isConnected = true;
      return true;
    } catch (error) {
      logger.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      throw error; // No fallback for production deployment
    }
  }

  // Session management for streaming users
  async setSession(userId, sessionData, ttl = 3600) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const key = `session:${userId}`;
      const result = await this.redis.setex(key, ttl, JSON.stringify(sessionData));
      return result === 'OK';
    } catch (error) {
      logger.error('Cache setSession error:', error);
      throw error;
    }
  }

  async getSession(userId) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const key = `session:${userId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache getSession error:', error);
      throw error;
    }
  }

  // Stream data caching for real-time performance
  async setStreamData(streamId, data, ttl = 300) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const key = `stream:${streamId}`;
      const result = await this.redis.setex(key, ttl, JSON.stringify(data));
      return result === 'OK';
    } catch (error) {
      logger.error('Cache setStreamData error:', error);
      throw error;
    }
  }

  async getStreamData(streamId) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const key = `stream:${streamId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache getStreamData error:', error);
      throw error;
    }
  }

  // Real-time viewer count tracking
  async incrementViewerCount(streamId) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const key = `viewers:${streamId}`;
      const count = await this.redis.incr(key);
      await this.redis.expire(key, 3600); // Auto-expire after 1 hour
      return count;
    } catch (error) {
      logger.error('Cache incrementViewerCount error:', error);
      throw error;
    }
  }

  async decrementViewerCount(streamId) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const key = `viewers:${streamId}`;
      const count = await this.redis.decr(key);
      return Math.max(0, count); // Ensure non-negative
    } catch (error) {
      logger.error('Cache decrementViewerCount error:', error);
      throw error;
    }
  }

  async getViewerCount(streamId) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const key = `viewers:${streamId}`;
      const count = await this.redis.get(key);
      return parseInt(count) || 0;
    } catch (error) {
      logger.error('Cache getViewerCount error:', error);
      throw error;
    }
  }

  // Rate limiting for API endpoints
  async checkRateLimit(identifier, limit = 100, window = 900) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const key = `ratelimit:${identifier}`;
      const current = await this.redis.incr(key);
      
      if (current === 1) {
        await this.redis.expire(key, window);
      }
      
      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;
      
      return { allowed, remaining, current };
    } catch (error) {
      logger.error('Cache checkRateLimit error:', error);
      throw error;
    }
  }

  // General cache operations
  async set(key, value, ttl = 3600) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const result = await this.redis.setex(key, ttl, JSON.stringify(value));
      return result === 'OK';
    } catch (error) {
      logger.error('Cache set error:', error);
      throw error;
    }
  }

  async get(key) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      throw error;
    }
  }

  async delete(key) {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', error);
      throw error;
    }
  }

  // Health check
  async ping() {
    try {
      if (!this.isConnected) {
        throw new Error('Redis not connected');
      }
      
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Cache ping error:', error);
      throw error;
    }
  }

  // Graceful shutdown
  async disconnect() {
    try {
      if (this.redis) {
        await this.redis.quit();
        logger.info('Redis cache disconnected gracefully');
      }
    } catch (error) {
      logger.error('Cache disconnect error:', error);
    }
  }
}

// Singleton instance
const cacheManager = new CacheManager();

module.exports = cacheManager;