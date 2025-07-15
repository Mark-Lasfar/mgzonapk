import { connectToDatabase } from '@/lib/db';
import { DynamicSettings } from '@/lib/types/settings';
import { logger } from '@/lib/api/services/logging';
import Settings from '@/lib/db/models/settings.model';

export async function getConfigFromDB(env: 'live' | 'sandbox' = 'live'): Promise<DynamicSettings> {
  try {
    await connectToDatabase(env);
    const settings = await Settings.findOne({ env }).lean();
    if (!settings) {
      logger.warn(`No settings found for ${env} environment`);
      return {
        email: '',
        notifications: {
          email: true,
          sms: false,
          orderUpdates: true,
          marketingEmails: false,
          pointsNotifications: true,
        },
        display: {
          showRating: true,
          showContactInfo: true,
          showMetrics: true,
          showPointsBalance: true,
        },
        security: {
          twoFactorAuth: false,
          loginNotifications: true,
        },
        customSite: {
          theme: 'default',
          primaryColor: '#000000',
        },
        shippingOptions: [],
        discountOffers: [],
        paymentGateways: [],
      };
    }
    return settings as DynamicSettings;
  } catch (error) {
    logger.error('Failed to fetch config from DB', { error: String(error) });
    throw new Error('Failed to fetch configuration');
  }
}