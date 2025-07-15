import { Redis } from '@upstash/redis';
import { logger } from './logging';

export class RateLimiter {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    });
  }

  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: Date;
  }> {
    try {
      const now = Date.now();
      const windowKey = `rate-limit:${key}:${Math.floor(now / (windowSeconds * 1000))}`;

      const currentCount = await this.redis.incr(windowKey);
      if (currentCount === 1) {
        await this.redis.expire(windowKey, windowSeconds);
      }

      const ttl = await this.redis.ttl(windowKey);
      const resetTime = new Date(now + ttl * 1000);

      const allowed = currentCount <= maxRequests;
      const remaining = Math.max(0, maxRequests - currentCount);

      logger.info('Rate limit check', { key, allowed, remaining, resetTime });
      return { allowed, remaining, resetTime };
    } catch (error) {
      logger.error('Rate limit check failed', { key, error });
      return { allowed: true, remaining: maxRequests, resetTime: new Date() };
    }
  }
}