import Redis from 'ioredis';

const redis = Redis.createClient({
	url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redis.on('connect' , ()=>console.log('🚀 Redis Connected'));
redis.on('error' , (err)=>console.log('❌ Redis Error:', err));

export const RedisUtil = {
  // Use for: Stock management, Rate limiting
  async increment(key, amount = 1) {
    return await redis.incrby(key, amount);
  },

  async decrement(key, amount = 1) {
    return await redis.decrby(key, amount);
  },

  // Use for: Fast Product/User lookups
  async setCache(key, value, ttlSeconds = 3600) {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    await redis.set(key, data, 'EX', ttlSeconds);
  },

  async getCache(key) {
    const data = await redis.get(key);
    try {
      return JSON.parse(data);
    } catch (e) {
      return data;
    }
  },

  // Use for: Distributed Locks (Prevents race conditions in orders)
  async acquireLock(key, timeoutMs = 5000) {
    const result = await redis.set(`lock:${key}`, 'locked', 'PX', timeoutMs, 'NX');
    return result === 'OK';
  },

  async releaseLock(key) {
    await redis.del(`lock:${key}`);
  }
};