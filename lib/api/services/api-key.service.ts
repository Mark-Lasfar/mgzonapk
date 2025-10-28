import { Redis } from '@upstash/redis';
import mongoose, { Types } from 'mongoose';
import ApiKey, { IApiKey } from '@/lib/db/models/api-key.model';
import { customLogger } from '@/lib/api/services/logging';
import crypto from 'crypto';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';

export class ApiKeyService {
  private static redis: Redis | null = null;
  private static readonly CACHE_PREFIX = 'api-key:';
  private static readonly CACHE_TTL = 3600;

  private static async getRedisClient(): Promise<Redis> {
    if (!this.redis) {
      if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
        throw new Error('Redis configuration is missing');
      }
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_TOKEN,
      });
    }
    return this.redis;
  }

  static async createApiKey(params: {
    name: string;
    permissions: string[];
    sellerId?: string;
    expiresAt?: Date;
  }): Promise<IApiKey> {
    const sessionAuth = await auth();
    if (!sessionAuth?.user?.id) {
      throw new Error('Unauthenticated user cannot create API key');
    }

    let sellerId: Types.ObjectId | undefined;
    if (params.sellerId && sessionAuth.user.role === 'Admin') {
      const seller = await Seller.findById(params.sellerId);
      if (!seller) throw new Error('Seller not found');
      sellerId = new Types.ObjectId(params.sellerId);
    } else {
      const seller = await Seller.findOne({ userId: sessionAuth.user.id });
      if (seller) {
        sellerId = seller._id;
      } else {
        // إذا مافيش seller، نستخدم userId بدلًا من رمي خطأ
        sellerId = new Types.ObjectId(sessionAuth.user.id);
      }
    }

    const createdBy = new Types.ObjectId(sessionAuth.user.id);

    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await connectToDatabase();

      const apiKeyDocs = await ApiKey.create(
        [{
          userId: createdBy,
          name: params.name,
          permissions: params.permissions,
          expiresAt: params.expiresAt,
          createdBy,
          updatedBy: createdBy,
          isActive: true,
          sellerId,
        }],
        { session }
      );

      const apiKeyDoc = apiKeyDocs[0];

      const redis = await this.getRedisClient();
      await redis.set(
        `${this.CACHE_PREFIX}${apiKeyDoc.key}`,
        JSON.stringify(apiKeyDoc),
        { ex: this.CACHE_TTL }
      );

      await customLogger.info('API key created', {
        keyId: apiKeyDoc._id,
        name: apiKeyDoc.name,
        userId: apiKeyDoc.userId,
        sellerId: apiKeyDoc.sellerId,
        timestamp: new Date(),
        service: 'api-key',
      });

      await session.commitTransaction();
      return apiKeyDoc;
    } catch (error) {
      await session.abortTransaction();
      await customLogger.error('Failed to create API key', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        service: 'api-key',
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

      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        const apiKeyDoc = JSON.parse(cached) as IApiKey;
        await this.logApiKeyUsage(apiKeyDoc, 'cache');
        return apiKeyDoc;
      }

      const apiKeyDoc = await ApiKey.findOne({
        key,
        isActive: true,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
      });

      if (!apiKeyDoc) {
        return null;
      }

      await ApiKey.findByIdAndUpdate(apiKeyDoc._id, {
        lastUsed: new Date(),
        updatedBy: apiKeyDoc.userId || apiKeyDoc.sellerId,
      });

      await redis.set(cacheKey, JSON.stringify(apiKeyDoc), { ex: this.CACHE_TTL });
      await this.logApiKeyUsage(apiKeyDoc, 'database');

      return apiKeyDoc;
    } catch (error) {
      await customLogger.error('API key validation failed', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        key,
        service: 'api-key',
      });
      throw error;
    }
  }

  static async rotateApiKey(id: string, options: { updatedBy: string }): Promise<IApiKey> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const apiKeyDoc = await ApiKey.findById(id).session(session);
      if (!apiKeyDoc) {
        throw new Error('API key not found');
      }

      apiKeyDoc.key = `mgz_${crypto.randomBytes(16).toString('hex')}`;
      apiKeyDoc.secret = crypto.randomBytes(32).toString('hex');
      apiKeyDoc.updatedBy = new Types.ObjectId(options.updatedBy);

      await apiKeyDoc.save({ session });

      const redis = await this.getRedisClient();
      await redis.del(`${this.CACHE_PREFIX}${apiKeyDoc.key}`);

      await customLogger.info('API key rotated', {
        keyId: apiKeyDoc._id,
        timestamp: new Date(),
        user: options.updatedBy,
        service: 'api-key',
      });

      await session.commitTransaction();
      return apiKeyDoc;
    } catch (error) {
      await session.abortTransaction();
      await customLogger.error('Failed to rotate API key', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        user: options.updatedBy,
        service: 'api-key',
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  static async deactivateApiKey(id: string, options: { updatedBy: string }): Promise<void> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const apiKeyDoc = await ApiKey.findById(id).session(session);
      if (!apiKeyDoc) {
        throw new Error('API key not found');
      }

      apiKeyDoc.isActive = false;
      apiKeyDoc.updatedBy = new Types.ObjectId(options.updatedBy);
      await apiKeyDoc.save({ session });

      const redis = await this.getRedisClient();
      await redis.del(`${this.CACHE_PREFIX}${apiKeyDoc.key}`);

      await customLogger.info('API key deactivated', {
        keyId: apiKeyDoc._id,
        timestamp: new Date(),
        user: options.updatedBy,
        service: 'api-key',
      });

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      await customLogger.error('Failed to deactivate API key', {
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        user: options.updatedBy,
        service: 'api-key',
      });
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private static async logApiKeyUsage(apiKeyDoc: IApiKey, source: 'cache' | 'database'): Promise<void> {
    await customLogger.info('API key used', {
      keyId: apiKeyDoc._id,
      name: apiKeyDoc.name,
      source,
      timestamp: new Date(),
      user: apiKeyDoc.userId?.toString() || apiKeyDoc.sellerId.toString(),
      service: 'api-key',
    });
  }
}