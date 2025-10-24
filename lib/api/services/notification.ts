import { logger } from './logging';
import { ObservabilityService } from './observability';
import { sendEmail } from '@/lib/services/email/mailer';

export class NotificationService {
  private observabilityService: ObservabilityService;

  constructor() {
    this.observabilityService = ObservabilityService.getInstance();
  }

  async sendEmail(recipients: string[], subject: string, data: any) {
    try {
      await sendEmail({
        to: recipients.join(','),
        subject,
        html: data.html || `<p>${data.message || 'No message provided'}</p>`,
        text: data.message || 'No message provided',
      });
      logger.info('Sending email notification', {
        recipients,
        subject,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { recipients, subject },
        timestamp: new Date(),
      });
      logger.error('Failed to send email notification', {
        error: errorMessage,
        recipients,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async sendSlackMessage(config: { webhook: string; channel: string }, data: any) {
    try {
      await fetch(config.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: config.channel,
          text: data.message || 'No message provided',
        }),
      });
      logger.info('Sending Slack notification', {
        channel: config.channel,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { channel: config.channel },
        timestamp: new Date(),
      });
      logger.error('Failed to send Slack notification', {
        error: errorMessage,
        channel: config.channel,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async sendWebhook(config: { url: string; headers?: Record<string, string> }, data: any) {
    try {
      await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers,
        },
        body: JSON.stringify(data),
      });
      logger.info('Sending webhook notification', {
        url: config.url,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { url: config.url },
        timestamp: new Date(),
      });
      logger.error('Failed to send webhook notification', {
        error: errorMessage,
        url: config.url,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}