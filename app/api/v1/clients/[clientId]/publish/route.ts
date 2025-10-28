// app/api/v1/clients/[clientId]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
  : null;

export async function POST(req: NextRequest, { params }: { params: { clientId: string } }) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');
  try {
    await connectToDatabase('live');
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized client publish', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const client = await Client.findOne({ clientId: params.clientId, createdBy: session.user.id });
    if (!client) {
      await customLogger.error('Client not found or unauthorized', {
        requestId,
        clientId: params.clientId,
        userId: session.user.id,
        service: 'api',
      });
      return NextResponse.json(
        { success: false, error: t('clientNotFound'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    if (client.isMarketplaceApp) {
      return NextResponse.json(
        { success: false, error: t('alreadyInMarketplace'), requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    client.isMarketplaceApp = true;
    client.status = 'pending';
    client.updatedBy = session.user.id;
    client.updatedAt = new Date();
    await client.save();

    if (redis) {
      await redis.del(`clients:${session.user.id}`);
    }

    await customLogger.info('Client submitted for Marketplace approval', {
      requestId,
      userId: session.user.id,
      clientId: params.clientId,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: {
        id: client._id,
        clientId: client.clientId,
        name: client.name,
        status: client.status,
        isMarketplaceApp: client.isMarketplaceApp,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to publish client', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}