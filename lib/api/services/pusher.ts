import Pusher from 'pusher';
import { logger } from './logging';
import { ObservabilityService } from './observability';
import { auth } from '@/auth';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export const pusherWithLogging = {
  async trigger(channel: string, event: string, data: any): Promise<void> {
    try {
      const observabilityService = ObservabilityService.getInstance();
      const session = await auth();
      const currentUser = session?.user?.id || 'system';
      const timestamp = new Date().toISOString();

      await pusher.trigger(channel, event, {
        ...data,
        timestamp,
        user: currentUser,
      });

      await observabilityService.recordMetric({
        name: 'pusher.event',
        value: 1,
        timestamp: new Date(),
        tags: { channel, event },
      });

      logger.info('Pusher event triggered successfully', {
        channel,
        event,
        timestamp,
        user: currentUser,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await observabilityService.recordError({
        error: errorMessage,
        context: { channel, event },
        timestamp: new Date(),
      });
      logger.error('Pusher event trigger failed', {
        channel,
        event,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  },
};

export { pusherWithLogging as pusher };