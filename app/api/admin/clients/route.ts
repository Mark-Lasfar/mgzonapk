import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.admin.clients');
  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      await customLogger.error('Unauthorized access to clients', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const clients = await Client.find();
    await customLogger.info('Clients retrieved successfully for admin', {
      requestId,
      count: clients.length,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: { clients },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to retrieve clients', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}