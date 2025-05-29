import axios from 'axios';
import WebhookModel from '@/lib/db/models/webhook.model';
import { logger } from './logging';

export class WebhookDispatcher {
  static async dispatch(userId: string, event: string, payload: any): Promise<void> {
    try {
      const webhooks = await WebhookModel.find({ userId, events: event, isActive: true });
      if (!webhooks.length) return;

      await Promise.all(
        webhooks.map(async (webhook) => {
          try {
            await axios.post(webhook.url, {
              event,
              data: payload,
              timestamp: new Date().toISOString(),
            }, {
              headers: {
                'X-Webhook-Secret': webhook.secret,
              },
            });
            webhook.lastTriggered = new Date();
            await webhook.save();
          } catch (error) {
            logger.error('Webhook dispatch failed', {
              webhookId: webhook._id,
              url: webhook.url,
              error: error.message,
            });
          }
        })
      );
    } catch (error) {
      logger.error('Webhook dispatch error', { error });
    }
  }
}