// /lib/actions/integration.actions.ts
'use server';

import { connectToDatabase } from '@/lib/db';
import Integration from '@/lib/db/models/integration.model';
import { getTranslations } from 'next-intl/server';

export async function getActivePaymentIntegrations(userId: string) {
  const t = await getTranslations('subscriptions');
  try {
    await connectToDatabase();
    const integrations = await Integration.find({
      enabledBySellers: userId,
      type: 'payment',
      category: 'payment',
      isActive: true,
      status: 'connected',
    });
    return {
      success: true,
      data: integrations.map((int: any) => ({
        id: int._id.toString(),
        providerName: int.providerName,
      })),
    };
  } catch (error) {
    console.error('Error fetching payment integrations:', error);
    return { success: false, error: t('errors.fetchFailed') };
  }
}
