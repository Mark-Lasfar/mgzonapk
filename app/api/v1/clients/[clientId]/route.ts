import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import crypto from 'crypto';

export async function GET(req: NextRequest, { params }: { params: { clientId: string } }) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');
  try {
    await connectToDatabase('live');
    const client = await Client.findOne({ clientId: params.clientId })
      .lean()
      .select('name redirectUris scopes');

    if (!client) {
      await customLogger.error('Client not found', {
        requestId,
        clientId: params.clientId,
        service: 'api',
      });
      return NextResponse.json(
        { success: false, error: t('clientNotFound'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    await customLogger.info('Client retrieved successfully', {
      requestId,
      clientId: params.clientId,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: {
        name: client.name,
        redirectUris: client.redirectUris,
        scopes: client.scopes,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to retrieve client', {
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