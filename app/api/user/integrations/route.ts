import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized access to integrations', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    await connectToDatabase('live');
    const integrations = await Client.find({ isMarketplaceApp: true, status: 'approved' })
      .lean()
      .select('name logoUrl description categories rating ratingsCount installs slug clientId createdAt');

    await customLogger.info('Integrations retrieved successfully', {
      requestId,
      userId: session.user.id,
      count: integrations.length,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: { clients: integrations },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to retrieve integrations', {
      requestId,
      error: errorMessage,
      service: 'api',
    });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}