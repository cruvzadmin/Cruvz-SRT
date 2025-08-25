const Redis = require('ioredis');
const logger = require('./logger');

class CacheManager {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.memoryCache = new Map(); // In-memory fallback
    this.useMemoryFallback = false;
    // Don't initialize in constructor - will be done explicitly in server startup
  }

  async init() {
    try {
      // Check if Redis is disabled for development/sandbox
      if (process.env.DISABLE_REDIS === 'true' || process.env.FORCE_SQLITE === 'true') {
        logger.warn('⚠️  Redis is disabled, using in-memory cache fallback for development');
        this.useMemoryFallback = true;
        this.isConnected = false;
        return false;
      }
      
      // Redis is REQUIRED for production - no fallback
      const redisHost = process.env.REDIS_HOST;
      if (!redisHost) {
        if (process.env.NODE_ENV === 'production') {
          const error = 'REDIS_HOST environment variable is required for production';
          logger.error(error);
          throw new Error(error);
        } else {
          logger.warn('⚠️  REDIS_HOST not set, using in-memory cache fallback for development');
          this.useMemoryFallback = true;
          this.isConnected = false;
          return false;
        }
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
        this.useMemoryFallback = false;
      });

      this.redis.on('error', (err) => {
        logger.error('Redis cache connection error - falling back to memory cache:', err.message);
        this.isConnected = false;
        this.useMemoryFallback = true;
        // In production, Redis failures should be treated as critical
        if (process.env.NODE_ENV === 'production') {
          logger.error('Redis connection lost in production environment');
        }
      });

      this.redis.on('close', () => {
        logger.error('Redis cache connection closed - using memory cache fallback');
        this.isConnected = false;
        this.useMemoryFallback = true;
      });

    } catch (error) {
      logger.error('Failed to initialize Redis cache - using memory cache fallback:', error.message);
      this.isConnected = false;
      this.useMemoryFallback = true;
      // In production, Redis must be available
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
    }
  }

  // Memory cache helper methods
  _setMemory(key, value, ttl) {
    const expireAt = Date.now() + (ttl * 1000);
    this.memoryCache.set(key, { value, expireAt });
    
    // Clean up expired entries occasionally
    if (Math.random() < 0.1) { // 10% chance
      this._cleanupMemoryCache();
    }
  }

  _getMemory(key) {
    const item = this.memoryCache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expireAt) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return item.value;
  }

  _deleteMemory(key) {
    return this.memoryCache.delete(key);
  }

  _cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (now > item.expireAt) {
        this.memoryCache.delete(key);
      }
    }
  }

  // Connect to Redis with proper error handling
  async connect() {
    try {
      if (this.useMemoryFallback) {
        logger.info('✅ Using in-memory cache (development mode)');
        return true;
      }

      if (!this.redis) {
        throw new Error('Redis not initialized');
      }
      
      // For ioredis with lazyConnect: true, we need to trigger a command to connect
      await this.redis.ping();
      logger.info('✅ Redis cache connected successfully');
      this.isConnected = true;
      this.useMemoryFallback = false;
      return true;
    } catch (error) {
      logger.error('❌ Redis connection failed, using memory fallback:', error.message);
      this.isConnected = false;
      this.useMemoryFallback = true;
      return true; // Still return true since we have fallback
    }
  }

  // Session management for streaming users
  async setSession(userId, sessionData, ttl = 3600) {
    try {
      if (this.useMemoryFallback) {
        this._setMemory(`session:${userId}`, sessionData, ttl);
        return true;
      }
      
      if (!this.isConnected) return false;
      
      const key = `session:${userId}`;
      const result = await this.redis.setex(key, ttl, JSON.stringify(sessionData));
      return result === 'OK';
    } catch (error) {
      logger.error('Cache setSession error:', error);
      return false;
    }
  }

  async getSession(userId) {
    try {
      if (this.useMemoryFallback) {
        return this._getMemory(`session:${userId}`);
      }
      
      if (!this.isConnected) return null;
      
      const key = `session:${userId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache getSession error:', error);
      return null;
    }
  }

  // Stream data caching for real-time performance
  async setStreamData(streamId, data, ttl = 300) {
    try {
      if (this.useMemoryFallback) {
        this._setMemory(`stream:${streamId}`, data, ttl);
        return true;
      }
      
      if (!this.isConnected) return false;
      
      const key = `stream:${streamId}`;
      const result = await this.redis.setex(key, ttl, JSON.stringify(data));
      return result === 'OK';
    } catch (error) {
      logger.error('Cache setStreamData error:', error);
      return false;
    }
  }

  async getStreamData(streamId) {
    try {
      if (this.useMemoryFallback) {
        return this._getMemory(`stream:${streamId}`);
      }
      
      if (!this.isConnected) return null;
      
      const key = `stream:${streamId}`;
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache getStreamData error:', error);
      return null;
    }
  }

  // Real-time viewer count tracking
  async incrementViewerCount(streamId) {
    try {
      if (this.useMemoryFallback) {
        const key = `viewers:${streamId}`;
        const current = this._getMemory(key) || 0;
        const newCount = current + 1;
        this._setMemory(key, newCount, 3600);
        return newCount;
      }
      
      if (!this.isConnected) return 0;
      
      const key = `viewers:${streamId}`;
      const count = await this.redis.incr(key);
      await this.redis.expire(key, 3600); // Auto-expire after 1 hour
      return count;
    } catch (error) {
      logger.error('Cache incrementViewerCount error:', error);
      return 0;
    }
  }

  async decrementViewerCount(streamId) {
    try {
      if (this.useMemoryFallback) {
        const key = `viewers:${streamId}`;
        const current = this._getMemory(key) || 0;
        const newCount = Math.max(0, current - 1);
        this._setMemory(key, newCount, 3600);
        return newCount;
      }
      
      if (!this.isConnected) return 0;
      
      const key = `viewers:${streamId}`;
      const count = await this.redis.decr(key);
      return Math.max(0, count); // Ensure non-negative
    } catch (error) {
      logger.error('Cache decrementViewerCount error:', error);
      return 0;
    }
  }

  async getViewerCount(streamId) {
    try {
      if (this.useMemoryFallback) {
        return this._getMemory(`viewers:${streamId}`) || 0;
      }
      
      if (!this.isConnected) return 0;
      
      const key = `viewers:${streamId}`;
      const count = await this.redis.get(key);
      return parseInt(count) || 0;
    } catch (error) {
      logger.error('Cache getViewerCount error:', error);
      return 0;
    }
  }

  // Rate limiting for API endpoints
  async checkRateLimit(identifier, limit = 100, window = 900) {
    try {
      if (this.useMemoryFallback) {
        const key = `ratelimit:${identifier}`;
        const current = this._getMemory(key) || 0;
        const newCount = current + 1;
        this._setMemory(key, newCount, window);
        
        const remaining = Math.max(0, limit - newCount);
        const allowed = newCount <= limit;
        
        return { allowed, remaining, current: newCount };
      }
      
      if (!this.isConnected) return { allowed: true, remaining: limit };
      
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
      return { allowed: true, remaining: limit };
    }
  }

  // General cache operations
  async set(key, value, ttl = 3600) {
    try {
      if (this.useMemoryFallback) {
        this._setMemory(key, value, ttl);
        return true;
      }
      
      if (!this.isConnected) return false;
      
      const result = await this.redis.setex(key, ttl, JSON.stringify(value));
      return result === 'OK';
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  async get(key) {
    try {
      if (this.useMemoryFallback) {
        return this._getMemory(key);
      }
      
      if (!this.isConnected) return null;
      
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async delete(key) {
    try {
      if (this.useMemoryFallback) {
        return this._deleteMemory(key);
      }
      
      if (!this.isConnected) return false;
      
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  // Health check
  async ping() {
    try {
      if (this.useMemoryFallback) {
        return true; // Memory cache is always available
      }
      
      if (!this.isConnected) return false;
      
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Cache ping error:', error);
      return false;
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