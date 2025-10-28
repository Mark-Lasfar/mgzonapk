import { Redis } from '@upstash/redis';
import { logger } from './logging';

const CURRENT_TIMESTAMP = '2025-04-27T13:00:05Z';
const CURRENT_USER = 'Mark-Lasfar';

export class CacheService {
  private static redis: Redis;
  private static readonly DEFAULT_TTL = 3600; // 1 hour in seconds

  private static async getRedisClient() {
    if (!this.redis) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_URL!,
        token: process.env.UPSTASH_REDIS_TOKEN!
      });
    }
    return this.redis;
  }

  static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = await this.getRedisClient();
      const cached = await redis.get(key);
      
      if (cached) {
        logger.info('Cache hit', {
          key,
          timestamp: CURRENT_TIMESTAMP,
          user: CURRENT_USER
        });
        return typeof cached === 'string' ? JSON.parse(cached) : null;
      }

      logger.info('Cache miss', {
        key,
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      return null;
    } catch (error) {
      logger.error(new Error('Cache get error'), {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      return null;
    }
  }

  static async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = this.DEFAULT_TTL
  ): Promise<void> {
    try {
      const redis = await this.getRedisClient();
      await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
      
      logger.info('Cache set', {
        key,
        ttlSeconds,
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
    } catch (error) {
      logger.error(new Error('Cache set error'), {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
    }
  }

  static async delete(key: string): Promise<void> {
    try {
      const redis = await this.getRedisClient();
      await redis.del(key);
      
      logger.info('Cache delete', {
        key,
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
    } catch (error) {
      logger.error(new Error('Cache delete error'), {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
    }
  }

  static async deletePattern(pattern: string): Promise<void> {
    try {
      const redis = await this.getRedisClient();
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        
        logger.info('Cache pattern delete', {
          pattern,
          keysDeleted: keys.length,
          timestamp: CURRENT_TIMESTAMP,
          user: CURRENT_USER
        });
      }
    } catch (error) {
      logger.error(new Error('Cache pattern delete error'), {
        pattern,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
    }
  }

  static async getOrSet<T>(
    key: string,
    getter: () => Promise<T>,
    ttlSeconds: number = this.DEFAULT_TTL
  ): Promise<T> {
    try {
      // Try to get from cache first
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // If not in cache, get fresh value
      const value = await getter();
      
      // Store in cache
      await this.set(key, value, ttlSeconds);
      
      return value;
    } catch (error) {
      logger.error(new Error('Cache getOrSet error'), {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      throw error;
    }
  }

  static async increment(
    key: string,
    amount: number = 1,
    ttlSeconds: number = this.DEFAULT_TTL
  ): Promise<number> {
    try {
      const redis = await this.getRedisClient();
      const value = await redis.incrby(key, amount);
      
      // Set TTL if this is a new key
      if (value === amount) {
        await redis.expire(key, ttlSeconds);
      }
      
      logger.info('Cache increment', {
        key,
        amount,
        newValue: value,
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      
      return value;
    } catch (error) {
      logger.error(new Error('Cache increment error'), {
        key,
        amount,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      throw error;
    }
  }

  static async decrement(
    key: string,
    amount: number = 1,
    ttlSeconds: number = this.DEFAULT_TTL
  ): Promise<number> {
    try {
      const redis = await this.getRedisClient();
      const value = await redis.decrby(key, amount);
      
      // Set TTL if this is a new key
      if (value === -amount) {
        await redis.expire(key, ttlSeconds);
      }
      
      logger.info('Cache decrement', {
        key,
        amount,
        newValue: value,
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      
      return value;
    } catch (error) {
      logger.error(new Error('Cache decrement error'), {
        key,
        amount,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      throw error;
    }
  }
}