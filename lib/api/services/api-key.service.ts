import { Redis } from '@upstash/redis';
import mongoose from 'mongoose';
import ApiKey, { IApiKey } from '@/lib/db/models/api-key.model';
import { logger } from './logging';
import crypto from 'crypto';

export class ApiKeyService {
  private static redis: Redis | null = null;
  private static readonly CACHE_PREFIX = 'api-key:';
  private static readonly CACHE_TTL = 3600; // 1 hour

  private static async getRedisClient(): Promise<Redis> {
    if (!this.redis) {
      if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        throw new Error('Redis configuration is missing');
      }
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    }
    return this.redis;
  }

  static async createApiKey(
    params: {
      name: string;
      permissions: string[];
      expiresAt?: Date;
      sellerId: mongoose.Types.ObjectId;
    },
    options: { createdBy: string; updatedBy: string }
  ): Promise<IApiKey> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const apiKey = await ApiKey.create(
        [
          {
            ...params,
            key: crypto.randomBytes(32).toString('hex'),
            secret: crypto.randomBytes(64).toString('hex'),
            createdBy: options.createdBy,
            updatedBy: options.updatedBy,
            isActive: true,
          },
        ],
        { session }
      );

      const redis = await this.getRedisClient();
      await redis.set(
        `${this.CACHE_PREFIX}${apiKey[0].key}`,
        JSON.stringify(apiKey[0]),
        { ex: this.CACHE_TTL }
      );

      logger.info('API key created', {
        keyId: apiKey[0]._id,
        name: apiKey[0].name,
        timestamp: new Date(),
        user: options.createdBy,
      });

      await session.commitTransaction();
      return apiKey[0];
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to create API key', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        user: options.createdBy,
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  static async validateApiKey(key: string): Promise<IApiKey | null> {
    try {
      const redis = await this.getRedisClient();
      const cacheKey = `${this.CACHE_PREFIX}${key}`;

      // Check cache
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        const apiKey = JSON.parse(cached) as IApiKey;
        await this.logApiKeyUsage(apiKey, 'cache');
        return apiKey;
      }

      // Check database
      const apiKey = await ApiKey.findOne({
        key,
        isActive: true,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
      });

      if (!apiKey) {
        return null;
      }

      // Update last used
      await ApiKey.findByIdAndUpdate(apiKey._id, {
        lastUsed: new Date(),
        updatedBy: 'system',
      });

      // Cache the result
      await redis.set(cacheKey, JSON.stringify(apiKey), { ex: this.CACHE_TTL });

      await this.logApiKeyUsage(apiKey, 'database');

      return apiKey;
    } catch (error) {
      logger.error('API key validation failed', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        key,
      });
      throw error;
    }
  }

  static async rotateApiKey(
    id: string,
    options: { updatedBy: string }
  ): Promise<IApiKey> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const apiKey = await ApiKey.findById(id).session(session);
      if (!apiKey) {
        throw new Error('API key not found');
      }

      apiKey.key = crypto.randomBytes(32).toString('hex');
      apiKey.secret = crypto.randomBytes(64).toString('hex');
      apiKey.updatedBy = options.updatedBy;
      await apiKey.save({ session });

      const redis = await this.getRedisClient();
      await redis.del(`${this.CACHE_PREFIX}${apiKey.key}`);

      logger.info('API key rotated', {
        keyId: apiKey._id,
        timestamp: new Date(),
        user: options.updatedBy,
      });

      await session.commitTransaction();
      return apiKey;
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to rotate API key', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        user: options.updatedBy,
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  static async deactivateApiKey(
    id: string,
    options: { updatedBy: string }
  ): Promise<void> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const apiKey = await ApiKey.findById(id).session(session);
      if (!apiKey) {
        throw new Error('API key not found');
      }

      apiKey.isActive = false;
      apiKey.updatedBy = options.updatedBy;
      await apiKey.save({ session });

      const redis = await this.getRedisClient();
      await redis.del(`${this.CACHE_PREFIX}${apiKey.key}`);

      logger.info('API key deactivated', {
        keyId: apiKey._id,
        timestamp: new Date(),
        user: options.updatedBy,
      });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      logger.error('Failed to deactivate API key', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        user: options.updatedBy,
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private static async logApiKeyUsage(apiKey: IApiKey, source: 'cache' | 'database'): Promise<void> {
    logger.info('API key used', {
      keyId: apiKey._id,
      name: apiKey.name,
      source,
      timestamp: new Date(),
      user: apiKey.sellerId || 'unknown',
    });
  }
}