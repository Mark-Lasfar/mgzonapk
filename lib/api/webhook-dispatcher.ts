import { Redis } from '@upstash/redis';
import { logger } from '@/lib/api/services/logging';
import axios from 'axios';
import crypto from 'crypto';
// import Webhook, { WebhookConfig } from '@/lib/db/models/webhook.model';
import Queue from '@/lib/db/models/queue.model';
import Webhook from '@/lib/db/models/webhook.model';
import { WebhookConfig } from '@/lib/types';

export class WebhookDispatcher {
  private static redis: Redis | null = null;
  private static readonly WEBHOOK_KEY_PREFIX = 'webhook:subscriptions:';
  private static readonly WEBHOOK_FAILURE_PREFIX = 'webhook:failures:';
  private static readonly MAX_FAILURES = 3;
  private static readonly FAILURE_WINDOW = 3600; // 1 hour
  private static readonly MAX_RETRIES = 5;
  private static readonly RETRY_BACKOFF = 1000; // 1 second

  private static async getRedisClient(): Promise<Redis> {
    if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      logger.error('Missing Redis environment variables');
      throw new Error('Redis configuration is missing');
    }

    if (!this.redis) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
    }
    return this.redis;
  }

  static async dispatch(userId: string, eventType: string, payload: any): Promise<void> {
    const requestId = crypto.randomUUID();
    try {
      const subscriptions = await this.getSubscriptions(userId, eventType);

      const webhookPayload = {
        eventType,
        timestamp: new Date().toISOString(),
        triggeredBy: userId,
        data: payload,
      };

      const dispatchPromises = subscriptions.map(async (subscription: { id: string; url: string; secret: string; headers: Record<string, string> }) => {
        try {
          const failures = await this.getFailureCount(subscription.id);
          if (failures >= this.MAX_FAILURES) {
            await this.deactivateSubscription(subscription.id);
            logger.warn('Webhook deactivated due to excessive failures', { subscriptionId: subscription.id, url: subscription.url });
            return;
          }

          const response = await axios.post(subscription.url, webhookPayload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Timestamp': webhookPayload.timestamp,
              'X-Webhook-Signature': this.generateSignature(subscription.secret, webhookPayload),
              'X-Request-ID': requestId,
              ...subscription.headers,
            },
            timeout: 10000,
          });

          if (response.status >= 200 && response.status < 300) {
            await this.resetFailureCount(subscription.id);
            logger.info('Webhook dispatched successfully', {
              requestId,
              userId,
              eventType,
              url: subscription.url,
              timestamp: webhookPayload.timestamp,
            });

            await Webhook.findOneAndUpdate(
              { _id: subscription.id },
              { lastTriggered: new Date(), retryCount: 0, lastError: null }
            );
          } else {
            throw new Error(`Webhook returned status ${response.status}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          await this.recordFailure(subscription.id);
          logger.error('Webhook dispatch failed', {
            requestId,
            userId,
            eventType,
            url: subscription.url,
            error: errorMessage,
            timestamp: webhookPayload.timestamp,
          });

          const webhook = await Webhook.findById(subscription.id).select('retryCount').lean() as Pick<WebhookConfig, 'retryCount'> | null;
          const retryCount = webhook?.retryCount ?? 0;

          if (retryCount < this.MAX_RETRIES) {
            const nextRetryAt = new Date(Date.now() + this.RETRY_BACKOFF * Math.pow(2, retryCount));
            await Queue.create({
              taskType: 'webhook retry',
              payload: { subscription, webhookPayload },
              priority: 3,
              nextRetryAt,
              attempts: retryCount + 1,
              createdAt: new Date(),
            });
            logger.info('Webhook retry scheduled', {
              requestId,
              subscriptionId: subscription.id,
              retryCount: retryCount + 1,
              nextRetryAt: nextRetryAt.toISOString(),
            });
          } else {
            logger.warn('Max retries reached for webhook', {
              requestId,
              subscriptionId: subscription.id,
              url: subscription.url,
            });
            await this.deactivateSubscription(subscription.id);
          }

          await Webhook.findOneAndUpdate(
            { _id: subscription.id },
            { lastError: errorMessage, $inc: { retryCount: 1 } }
          );
        }
      });

      await Promise.all(dispatchPromises);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Webhook dispatch error', {
        requestId,
        userId,
        eventType,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Webhook dispatch failed: ${errorMessage}`);
    }
  }

  private static async getSubscriptions(userId: string, eventType: string): Promise<Array<{ id: string; url: string; secret: string; headers: Record<string, string> }>> {
    const redis = await this.getRedisClient();
    const key = `${this.WEBHOOK_KEY_PREFIX}${userId}:${eventType}`;
    const cachedSubscriptions = await redis.get(key);
    if (cachedSubscriptions) {
      return JSON.parse(String(cachedSubscriptions));
    }

    const webhooks = await Webhook.find({ userId, events: eventType, isActive: true }).lean();
    const subscriptions = webhooks.map((webhook) => ({
      id: webhook._id?.toString() ?? '',
      url: webhook.url,
      secret: webhook.secret,
      headers: webhook.headers || {},
    }));

    await redis.set(key, JSON.stringify(subscriptions), { ex: 3600 });
    return subscriptions;
  }

  private static generateSignature(secret: string, payload: any): string {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private static async getFailureCount(subscriptionId: string): Promise<number> {
    const redis = await this.getRedisClient();
    const key = `${this.WEBHOOK_FAILURE_PREFIX}${subscriptionId}`;
    const count = await redis.get(key);
    return count ? parseInt(String(count), 10) : 0;
  }

  private static async recordFailure(subscriptionId: string): Promise<void> {
    const redis = await this.getRedisClient();
    const key = `${this.WEBHOOK_FAILURE_PREFIX}${subscriptionId}`;
    await redis.incr(key);
    await redis.expire(key, this.FAILURE_WINDOW);
  }

  private static async resetFailureCount(subscriptionId: string): Promise<void> {
    const redis = await this.getRedisClient();
    const key = `${this.WEBHOOK_FAILURE_PREFIX}${subscriptionId}`;
    await redis.del(key);
  }

  private static async deactivateSubscription(subscriptionId: string): Promise<void> {
    const redis = await this.getRedisClient();
    await redis.del(`${this.WEBHOOK_KEY_PREFIX}${subscriptionId}`);
    await Webhook.findOneAndUpdate(
      { _id: subscriptionId },
      { isActive: false, lastError: 'Deactivated due to excessive failures' }
    );

    logger.warn('Webhook subscription deactivated', {
      subscriptionId,
      timestamp: new Date().toISOString(),
    });
  }

  static async registerWebhook(
    userId: string,
    eventType: string,
    url: string,
    secret: string,
    headers?: Record<string, string>
  ): Promise<any> {
    const requestId = crypto.randomUUID();
    try {
      const redis = await this.getRedisClient();

      const webhook = await Webhook.create({
        userId,
        url,
        events: [eventType],
        secret,
        isActive: true,
        headers,
      });

      const subscription = {
        id: webhook._id?.toString() ?? '',
        url,
        secret,
        headers: headers || {},
        createdAt: new Date().toISOString(),
        createdBy: userId,
      };

      const key = `${this.WEBHOOK_KEY_PREFIX}${userId}:${eventType}`;
      const existingSubscriptions = await this.getSubscriptions(userId, eventType);

      await redis.set(
        key,
        JSON.stringify([...existingSubscriptions, subscription]),
        { ex: 3600 }
      );

      logger.info('Webhook subscription registered', {
        requestId,
        userId,
        eventType,
        url,
        timestamp: new Date().toISOString(),
      });

      return subscription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to register webhook', {
        requestId,
        userId,
        eventType,
        url,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Webhook registration failed: ${errorMessage}`);
    }
  }
}