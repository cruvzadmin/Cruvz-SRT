const logger = require('./logger');

class SimpleCacheManager {
  constructor() {
    this.cache = new Map();
    this.isConnected = true; // Always connected for in-memory cache
  }

  async init() {
    logger.info('💾 Using in-memory cache for development');
    return true;
  }

  async connect() {
    // No connection needed for in-memory cache
    return true;
  }

  async ping() {
    return true;
  }

  async get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (item.expires && Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key, value, ttlSeconds = 3600) {
    const expires = ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null;
    this.cache.set(key, { value, expires });
    return 'OK';
  }

  async del(key) {
    return this.cache.delete(key) ? 1 : 0;
  }

  async setex(key, seconds, value) {
    return this.set(key, value, seconds);
  }

  async exists(key) {
    return this.cache.has(key) ? 1 : 0;
  }

  async incr(key) {
    const current = await this.get(key) || 0;
    const newValue = parseInt(current) + 1;
    await this.set(key, newValue);
    return newValue;
  }

  async decr(key) {
    const current = await this.get(key) || 0;
    const newValue = parseInt(current) - 1;
    await this.set(key, newValue);
    return newValue;
  }

  async expire(key, seconds) {
    const item = this.cache.get(key);
    if (!item) return 0;
    
    item.expires = Date.now() + (seconds * 1000);
    return 1;
  }

  async flushall() {
    this.cache.clear();
    return 'OK';
  }

  // Cleanup expired items periodically
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (item.expires && now > item.expires) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Clean up every minute
  }
}

module.exports = new SimpleCacheManager();