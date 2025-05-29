import { Redis } from '@upstash/redis';
import { logger } from './logging';

const CURRENT_TIMESTAMP = '2025-04-27T12:52:45Z';
const CURRENT_USER = 'Mark-Lasfar';

export class RateLimiter {
  private static redis: Redis;
  private static readonly RATE_LIMIT_PREFIX = 'rate-limit:';
  
  private static async getRedisClient() {
    if (!this.redis) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!
      });
    }
    return this.redis;
  }

  static async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  }> {
    try {
      const redis = await this.getRedisClient();
      const now = new Date(CURRENT_TIMESTAMP);
      const windowKey = `${this.RATE_LIMIT_PREFIX}${key}:${Math.floor(now.getTime() / (windowSeconds * 1000))}`;

      // Get current count
      const currentCount = await redis.incr(windowKey);

      // Set expiration if this is the first request in the window
      if (currentCount === 1) {
        await redis.expire(windowKey, windowSeconds);
      }

      const ttl = await redis.ttl(windowKey);
      const resetTime = new Date(now.getTime() + (ttl * 1000));

      const allowed = currentCount <= maxRequests;
      const remaining = Math.max(0, maxRequests - currentCount);

      // Log rate limit check
      logger.info('Rate limit check', {
        key,
        allowed,
        remaining,
        resetTime: resetTime.toISOString(),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });

      return {
        allowed,
        remaining,
        resetTime
      };
    } catch (error) {
      logger.error(new Error('Rate limit check failed'), {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      
      // Fail open if Redis is unavailable
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: new Date(CURRENT_TIMESTAMP)
      };
    }
  }

  static async getRateLimitInfo(
    key: string,
    windowSeconds: number
  ): Promise<{
    currentCount: number;
    resetTime: Date;
  }> {
    try {
      const redis = await this.getRedisClient();
      const now = new Date(CURRENT_TIMESTAMP);
      const windowKey = `${this.RATE_LIMIT_PREFIX}${key}:${Math.floor(now.getTime() / (windowSeconds * 1000))}`;

      const [count, ttl] = await Promise.all([
        redis.get(windowKey),
        redis.ttl(windowKey)
      ]);

      const currentCount = count ? parseInt(String(count), 10) : 0;
      const resetTime = new Date(now.getTime() + (ttl * 1000));

      return {
        currentCount,
        resetTime
      };
    } catch (error) {
      logger.error(new Error('Get rate limit info failed'), {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      
      return {
        currentCount: 0,
        resetTime: new Date(CURRENT_TIMESTAMP)
      };
    }
  }

  static async resetRateLimit(key: string): Promise<void> {
    try {
      const redis = await this.getRedisClient();
      const pattern = `${this.RATE_LIMIT_PREFIX}${key}:*`;
      
      // Get all keys matching the pattern
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        // Delete all matching keys
        await redis.del(...keys);
        
        logger.info('Rate limit reset', {
          key,
          keysDeleted: keys.length,
          timestamp: CURRENT_TIMESTAMP,
          user: CURRENT_USER
        });
      }
    } catch (error) {
      logger.error(new Error('Reset rate limit failed'), {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      throw error;
    }
  }

  static async hasExceededRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<boolean> {
    const { allowed } = await this.checkRateLimit(key, maxRequests, windowSeconds);
    return !allowed;
  }

  static async incrementRateLimit(
    key: string,
    windowSeconds: number
  ): Promise<number> {
    try {
      const redis = await this.getRedisClient();
      const now = new Date(CURRENT_TIMESTAMP);
      const windowKey = `${this.RATE_LIMIT_PREFIX}${key}:${Math.floor(now.getTime() / (windowSeconds * 1000))}`;

      const count = await redis.incr(windowKey);
      
      // Set expiration if this is the first request
      if (count === 1) {
        await redis.expire(windowKey, windowSeconds);
      }

      return count;
    } catch (error) {
      logger.error(new Error('Increment rate limit failed'), {
        key,
        error: error instanceof Error ? error.message : String(error),
        timestamp: CURRENT_TIMESTAMP,
        user: CURRENT_USER
      });
      throw error;
    }
  }
}