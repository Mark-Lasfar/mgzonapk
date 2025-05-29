import { initializeApp } from 'firebase/app';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebaseConfig } from './config';
import { logger } from '@/lib/api/services/logging';
import { ObservabilityService } from '@/lib/api/services/observability';

const app = initializeApp(firebaseConfig);

export async function initializeFirebaseMessaging(): Promise<string | null> {
  const observabilityService = ObservabilityService.getInstance();

  try {
    const messaging = getMessaging(app);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission denied');
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY,
    });

    if (token) {
      logger.info('FCM token obtained', {
        token: token.slice(0, 10) + '...',
        timestamp: new Date().toISOString(),
      });

      await registerDeviceToken(token);

      await observabilityService.recordMetric({
        name: 'fcm.token.created',
        value: 1,
        timestamp: new Date(),
      });

      return token;
    }

    throw new Error('No token received');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await observabilityService.recordError({
      error: errorMessage,
      context: { endpoint: 'initializeFirebaseMessaging' },
      timestamp: new Date(),
    });
    logger.error('Error initializing Firebase Messaging', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
}

async function registerDeviceToken(token: string): Promise<any> {
  const observabilityService = ObservabilityService.getInstance();

  try {
    const response = await fetch('/api/notifications/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      throw new Error('Failed to register device token');
    }

    await observabilityService.recordMetric({
      name: 'fcm.token.registered',
      value: 1,
      timestamp: new Date(),
    });

    logger.info('Device token registered', {
      token: token.slice(0, 10) + '...',
      timestamp: new Date().toISOString(),
    });

    return await response.json();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await observabilityService.recordError({
      error: errorMessage,
      context: { token: token.slice(0, 10) + '...' },
      timestamp: new Date(),
    });
    logger.error('Error registering device token', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}