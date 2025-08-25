// Mock cache for development/testing when Redis is not available
// This provides a degraded mode to allow server startup

class MockCache {
  constructor() {
    this.store = new Map();
    this.isConnected = false;
    console.warn('⚠️  Using mock cache - limited functionality and no persistence');
  }

  async init() {
    this.isConnected = false; // Mark as disconnected but don't fail
    return Promise.resolve();
  }

  async connect() {
    this.isConnected = false; // Mark as disconnected but don't fail
    return Promise.resolve(true);
  }

  // Session management for streaming users
  async setSession(userId, sessionData, ttl = 3600) {
    try {
      const key = `session:${userId}`;
      this.store.set(key, JSON.stringify(sessionData));
      // Simulate TTL with setTimeout
      setTimeout(() => {
        this.store.delete(key);
      }, ttl * 1000);
      return true;
    } catch (error) {
      console.error('Mock cache setSession error:', error);
      return false;
    }
  }

  async getSession(userId) {
    try {
      const key = `session:${userId}`;
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Mock cache getSession error:', error);
      return null;
    }
  }

  // Stream data caching for real-time performance
  async setStreamData(streamId, data, ttl = 300) {
    try {
      const key = `stream:${streamId}`;
      this.store.set(key, JSON.stringify(data));
      // Simulate TTL with setTimeout
      setTimeout(() => {
        this.store.delete(key);
      }, ttl * 1000);
      return true;
    } catch (error) {
      console.error('Mock cache setStreamData error:', error);
      return false;
    }
  }

  async getStreamData(streamId) {
    try {
      const key = `stream:${streamId}`;
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Mock cache getStreamData error:', error);
      return null;
    }
  }

  // Real-time viewer count tracking
  async incrementViewerCount(streamId) {
    try {
      const key = `viewers:${streamId}`;
      const current = parseInt(this.store.get(key) || '0');
      const newCount = current + 1;
      this.store.set(key, newCount.toString());
      return newCount;
    } catch (error) {
      console.error('Mock cache incrementViewerCount error:', error);
      return 0;
    }
  }

  async decrementViewerCount(streamId) {
    try {
      const key = `viewers:${streamId}`;
      const current = parseInt(this.store.get(key) || '0');
      const newCount = Math.max(0, current - 1);
      this.store.set(key, newCount.toString());
      return newCount;
    } catch (error) {
      console.error('Mock cache decrementViewerCount error:', error);
      return 0;
    }
  }

  async getViewerCount(streamId) {
    try {
      const key = `viewers:${streamId}`;
      const count = this.store.get(key);
      return parseInt(count) || 0;
    } catch (error) {
      console.error('Mock cache getViewerCount error:', error);
      return 0;
    }
  }

  // Rate limiting for API endpoints
  async checkRateLimit(identifier, limit = 100, window = 900) {
    try {
      const key = `ratelimit:${identifier}`;
      const current = parseInt(this.store.get(key) || '0') + 1;
      this.store.set(key, current.toString());
      
      // Simulate window expiration
      setTimeout(() => {
        this.store.delete(key);
      }, window * 1000);
      
      const remaining = Math.max(0, limit - current);
      const allowed = current <= limit;
      
      return { allowed, remaining, current };
    } catch (error) {
      console.error('Mock cache checkRateLimit error:', error);
      return { allowed: true, remaining: limit, current: 0 };
    }
  }

  // General cache operations
  async set(key, value, ttl = 3600) {
    try {
      this.store.set(key, JSON.stringify(value));
      // Simulate TTL with setTimeout
      setTimeout(() => {
        this.store.delete(key);
      }, ttl * 1000);
      return true;
    } catch (error) {
      console.error('Mock cache set error:', error);
      return false;
    }
  }

  async get(key) {
    try {
      const data = this.store.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Mock cache get error:', error);
      return null;
    }
  }

  async delete(key) {
    try {
      return this.store.delete(key);
    } catch (error) {
      console.error('Mock cache delete error:', error);
      return false;
    }
  }

  // Health check
  async ping() {
    return false; // Always return false to indicate this is mock cache
  }

  // Graceful shutdown
  async disconnect() {
    this.store.clear();
    return Promise.resolve();
  }
}

module.exports = new MockCache();