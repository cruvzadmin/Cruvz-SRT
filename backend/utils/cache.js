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
      // Allow graceful fallback when Redis is not available
      const redisHost = process.env.REDIS_HOST;
      if (!redisHost) {
        const error = 'REDIS_HOST environment variable is not set - cache disabled';
        logger.warn(error);
        this.isConnected = false;
        return false;
      }

      const redisConfig = {
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3, // Increased retries
        lazyConnect: true,
        enableAutoPipelining: true,
        keepAlive: 30000,
        family: 4,
        // Production optimizations for 1000+ users
        connectTimeout: 10000, // Increased timeout
        commandTimeout: 10000, // Increased timeout
        maxLoadingTimeout: 10000, // Increased timeout
        db: 0,
        // Enable offline queue to prevent errors during reconnection
        enableOfflineQueue: true,
        // Retry strategy for production resilience
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        // Connection pool settings
        reconnectOnError: (err) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        }
      };

      this.redis = new Redis(redisConfig);

      this.redis.on('connect', () => {
        logger.info('Redis cache connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (err) => {
        logger.error('Redis cache connection error:', err.message);
        this.isConnected = false;
        // In production deployment, Redis failures are critical but don't stop server startup
        if (process.env.NODE_ENV === 'production') {
          logger.error(`Redis connection failed: ${err.message}`);
        }
      });

      this.redis.on('close', () => {
        logger.error('Redis cache connection closed');
        this.isConnected = false;
        // Don't throw error on close for graceful degradation
      });

    } catch (error) {
      logger.error('Failed to initialize Redis cache:', error.message);
      this.isConnected = false;
      // Allow graceful fallback when Redis is not available
      if (process.env.NODE_ENV === 'production') {
        logger.warn('Redis cache not available in production - performance may be affected');
      }
      return false;
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
      // Allow graceful fallback for development
      if (process.env.NODE_ENV === 'production') {
        logger.warn('Redis connection failed in production - continuing without cache');
      }
      return false;
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