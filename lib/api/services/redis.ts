import { Redis } from '@upstash/redis';
import { logger } from './logging';

export class RedisClient {
  private static instance: Redis;

  private constructor() {}

  static getInstance(): Redis {
    if (!this.instance) {
      if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        throw new Error('Redis configuration is missing');
      }
      this.instance = new Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      logger.info('Redis client initialized', {
        timestamp: new Date().toISOString(),
      });
    }
    return this.instance;
  }

  static async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getInstance().get(key);
      return value ? JSON.parse(String(value)) : null;
    } catch (error) {
      logger.error('Redis get error', {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      return null;
    }
  }

  static async set<T>(key: string, value: T, options: { ex?: number } = {}): Promise<void> {
    try {
      await this.getInstance().set(
        key,
        JSON.stringify(value),
        options.ex ? { ex: options.ex } : {}
      );
      logger.info('Redis set', { key, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Redis set error', {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  static async del(key: string): Promise<void> {
    try {
      await this.getInstance().del(key);
      logger.info('Redis delete', { key, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Redis delete error', {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  static async incr(key: string, by: number = 1): Promise<number> {
    try {
      const result = await this.getInstance().incrby(key, by);
      logger.info('Redis increment', {
        key,
        by,
        result,
        timestamp: new Date().toISOString(),
      });
      return result;
    } catch (error) {
      logger.error('Redis increment error', {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}