import { Redis } from '@upstash/redis'
import { logger } from './services/logging'
import axios from 'axios'
import crypto from 'crypto'
import Webhook from '../db/models/webhook.model'
import Queue from '../db/models/queue.model'

export class WebhookDispatcher {
  private static redis: Redis | null = null
  private static readonly WEBHOOK_KEY_PREFIX = 'webhook:subscriptions:'
  private static readonly WEBHOOK_FAILURE_PREFIX = 'webhook:failures:'
  private static readonly MAX_FAILURES = 3
  private static readonly FAILURE_WINDOW = 3600
  private static readonly MAX_RETRIES = 5
  private static readonly RETRY_BACKOFF = 1000

  private static async getRedisClient() {
    if (!this.redis) {
      this.redis = new Redis({
        url: process.env.UPSTASH_REDIS_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      })
    }
    return this.redis
  }

  static async dispatch(
    userId: string,
    eventType: string,
    payload: any
  ): Promise<void> {
    try {
      const subscriptions = await this.getSubscriptions(userId, eventType)

      const webhookPayload = {
        eventType,
        timestamp: new Date().toISOString(),
        triggeredBy: userId,
        data: payload,
      }

      const dispatchPromises = subscriptions.map(async (subscription: { id: string; url: string; secret: string; headers: Record<string, string> }) => {
        try {
          const failures = await this.getFailureCount(subscription.id)
          if (failures >= this.MAX_FAILURES) {
            await this.deactivateSubscription(subscription.id)
            return
          }

          const response = await axios.post(subscription.url, webhookPayload, {
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Timestamp': webhookPayload.timestamp,
              'X-Webhook-Signature': this.generateSignature(subscription.secret, webhookPayload),
              ...subscription.headers,
            },
            timeout: 5000,
          })

          if (response.status >= 200 && response.status < 300) {
            await this.resetFailureCount(subscription.id)
            logger.info('Webhook dispatched successfully', {
              userId,
              eventType,
              url: subscription.url,
              timestamp: webhookPayload.timestamp,
              triggeredBy: userId,
            })

            await Webhook.findOneAndUpdate(
              { _id: subscription.id },
              { lastTriggered: new Date(), retryCount: 0, lastError: null }
            )
          } else {
            throw new Error(`Webhook returned status ${response.status}`)
          }
        } catch (error) {
          await this.recordFailure(subscription.id)
          const errorMessage = error instanceof Error ? error.message : String(error)
          logger.error('Webhook dispatch failed', {
            userId,
            eventType,
            url: subscription.url,
            error: errorMessage,
            timestamp: webhookPayload.timestamp,
            triggeredBy: userId,
          })

          const retries = await Webhook.findById(subscription.id).select('retryCount').lean()
          if ((retries?.retryCount || 0) < this.MAX_RETRIES) {
            await Queue.create({
              taskType: 'webhook_retry',
              payload: { subscription, webhookPayload },
              priority: 3,
              nextRetryAt: new Date(Date.now() + this.RETRY_BACKOFF * (retries?.retryCount || 1)),
            })
          }

          await Webhook.findOneAndUpdate(
            { _id: subscription.id },
            { lastError: errorMessage, $inc: { retryCount: 1 } }
          )
        }
      })

      await Promise.all(dispatchPromises)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Webhook dispatch error', {
        userId,
        eventType,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        triggeredBy: userId,
      })
      throw error
    }
  }

  private static async getSubscriptions(userId: string, eventType: string) {
    const redis = await this.getRedisClient()
    const key = `${this.WEBHOOK_KEY_PREFIX}${userId}:${eventType}`
    const cachedSubscriptions = await redis.get(key)
    if (cachedSubscriptions) {
      return JSON.parse(String(cachedSubscriptions))
    }

    const webhooks = await Webhook.find({ userId, events: eventType, isActive: true }).lean()
    const subscriptions = webhooks.map((webhook) => ({
      id: webhook._id.toString(),
      url: webhook.url,
      secret: webhook.secret,
      headers: {},
    }))

    await redis.set(key, JSON.stringify(subscriptions), { ex: 3600 })
    return subscriptions
  }

  private static generateSignature(secret: string, payload: any): string {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')
  }

  private static async getFailureCount(subscriptionId: string): Promise<number> {
    const redis = await this.getRedisClient()
    const key = `${this.WEBHOOK_FAILURE_PREFIX}${subscriptionId}`
    const count = await redis.get(key)
    return count ? parseInt(String(count), 10) : 0
  }

  private static async recordFailure(subscriptionId: string): Promise<void> {
    const redis = await this.getRedisClient()
    const key = `${this.WEBHOOK_FAILURE_PREFIX}${subscriptionId}`
    await redis.incr(key)
    await redis.expire(key, this.FAILURE_WINDOW)
  }

  private static async resetFailureCount(subscriptionId: string): Promise<void> {
    const redis = await this.getRedisClient()
    const key = `${this.WEBHOOK_FAILURE_PREFIX}${subscriptionId}`
    await redis.del(key)
  }

  private static async deactivateSubscription(subscriptionId: string): Promise<void> {
    const redis = await this.getRedisClient()
    await redis.del(`${this.WEBHOOK_KEY_PREFIX}${subscriptionId}`)
    await Webhook.findOneAndUpdate(
      { _id: subscriptionId },
      { isActive: false, lastError: 'Deactivated due to excessive failures' }
    )

    logger.warn('Webhook subscription deactivated', {
      subscriptionId,
      timestamp: new Date().toISOString(),
    })
  }

  static async registerWebhook(
    userId: string,
    eventType: string,
    url: string,
    secret: string,
    headers?: Record<string, string>
  ) {
    try {
      const redis = await this.getRedisClient()

      const webhook = await Webhook.create({
        userId,
        url,
        events: [eventType],
        secret,
        isActive: true,
      })

      const subscription = {
        id: webhook._id.toString(),
        url,
        secret,
        headers: headers || {},
        createdAt: new Date().toISOString(),
        createdBy: userId,
      }

      const key = `${this.WEBHOOK_KEY_PREFIX}${userId}:${eventType}`
      const existingSubscriptions = await this.getSubscriptions(userId, eventType)

      await redis.set(
        key,
        JSON.stringify([...existingSubscriptions, subscription]),
        { ex: 3600 }
      )

      logger.info('Webhook subscription registered', {
        userId,
        eventType,
        url,
        timestamp: new Date().toISOString(),
        triggeredBy: userId,
      })

      return subscription
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to register webhook', {
        userId,
        eventType,
        url,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        triggeredBy: userId,
      })
      throw error
    }
  }
}