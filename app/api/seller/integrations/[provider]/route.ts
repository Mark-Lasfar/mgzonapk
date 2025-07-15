// /home/hager/Trash/my-nextjs-project-master/app/api/seller/integrations/[provider]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import SyncProgress from '@/lib/db/models/sync-progress.model';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';

// Schema for PATCH request validation
const integrationUpdateSchema = z.object({
  description: z.string().max(500, 'Description cannot exceed 500 characters').optional(),
  webhook: z
    .object({
      enabled: z.boolean().default(false),
      url: z.string().url('Invalid URL').optional(),
      events: z.array(z.string()).optional(),
      secret: z.string().optional(),
    })
    .optional(),
  apiEndpoints: z.record(z.string().url('Invalid URL')).optional(),
  credentials: z.record(z.string()).optional(),
});

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('seller.integrations.provider');
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: t('Unauthorized') }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');
    const data = await Integration.aggregate([
      { $match: { providerName: params.provider, isActive: true } },
      {
        $lookup: {
          from: 'sellerintegrations',
          let: { intId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$integrationId', '$$intId'] },
                    { $eq: ['$sellerId', new mongoose.Types.ObjectId(session.user.id)] },
                    { $eq: ['$sandbox', sandbox] },
                  ],
                },
              },
            },
          ],
          as: 'sellerInt',
        },
      },
      {
        $lookup: {
          from: 'syncprogresses',
          let: { providerName: '$providerName' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$provider', '$$providerName'] },
                    { $eq: ['$sellerId', new mongoose.Types.ObjectId(session.user.id)] },
                  ],
                },
              },
            },
          ],
          as: 'syncProgress',
        },
      },
      {
        $project: {
          _id: 1,
          providerName: 1,
          type: 1,
          logoUrl: 1,
          description: 1,
          videos: 1,
          images: 1,
          buttons: 1,
          webhook: {
            $cond: {
              if: { $gt: [{ $size: '$sellerInt' }, 0] },
              then: {
                enabled: { $arrayElemAt: ['$sellerInt.webhook.enabled', 0] },
                url: { $arrayElemAt: ['$sellerInt.webhook.url', 0] },
                events: { $arrayElemAt: ['$sellerInt.webhook.events', 0] },
                secret: { $arrayElemAt: ['$sellerInt.webhook.secret', 0] },
              },
              else: null,
            },
          },
          apiEndpoints: {
            $cond: {
              if: { $gt: [{ $size: '$sellerInt' }, 0] },
              then: { $arrayElemAt: ['$sellerInt.apiEndpoints', 0] },
              else: null,
            },
          },
          credentials: {
            $cond: {
              if: { $gt: [{ $size: '$sellerInt' }, 0] },
              then: { $arrayElemAt: ['$sellerInt.credentials', 0] },
              else: null,
            },
          },
          connected: { $gt: [{ $size: '$sellerInt' }, 0] },
          status: { $arrayElemAt: ['$sellerInt.status', 0] },
          lastUpdated: { $arrayElemAt: ['$sellerInt.lastUpdated', 0] },
          inventoryStats: {
            totalItems: { $arrayElemAt: ['$syncProgress.inventoryTotal', 0] },
            lastSynced: { $arrayElemAt: ['$syncProgress.inventoryLastSynced', 0] },
          },
          orderStats: {
            totalOrders: { $arrayElemAt: ['$syncProgress.ordersTotal', 0] },
            pending: { $arrayElemAt: ['$syncProgress.ordersPending', 0] },
            lastSynced: { $arrayElemAt: ['$syncProgress.ordersLastSynced', 0] },
          },
        },
      },
    ]);

    if (!data.length) {
      return NextResponse.json({ error: t('Not Found') }, { status: 404 });
    }

    // Decrypt sensitive fields
    const result = data[0];
    if (result.webhook?.secret) {
      result.webhook.secret = decrypt(result.webhook.secret);
    }
    if (result.credentials) {
      result.credentials = Object.fromEntries(
        Object.entries(result.credentials).map(([key, value]) => [key, decrypt(value as string)])
      );
    }

    customLogger.info('Integration details fetched', { requestId, provider: params.provider, sandbox });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    customLogger.error('Failed to fetch integration details', { requestId, error: errorMessage });
    return NextResponse.json({ error: `${t('Error Title')}: ${errorMessage}` }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { provider: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('seller.integrations.provider');
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: t('Unauthorized') }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = integrationUpdateSchema.parse(body);

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    // Find the integration
    const integration = await Integration.findOne({ providerName: params.provider });
    if (!integration) {
      return NextResponse.json({ error: t('Not Found') }, { status: 404 });
    }

    // Encrypt sensitive fields
    if (validatedData.webhook?.secret) {
      validatedData.webhook.secret = encrypt(validatedData.webhook.secret);
    }
    if (validatedData.credentials) {
      validatedData.credentials = Object.fromEntries(
        Object.entries(validatedData.credentials).map(([key, value]) => [key, encrypt(value)])
      );
    }

    // Update SellerIntegration
    const updateResult = await SellerIntegration.updateOne(
      {
        integrationId: integration._id,
        sellerId: session.user.id,
        sandbox,
      },
      {
        $set: {
          description: validatedData.description,
          webhook: validatedData.webhook,
          apiEndpoints: validatedData.apiEndpoints,
          credentials: validatedData.credentials,
          lastUpdated: new Date(),
        },
        $push: {
          history: { event: 'updated', date: new Date() },
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ error: t('Not Found') }, { status: 404 });
    }

    customLogger.info('Integration updated', { requestId, provider: params.provider, sandbox });
    return NextResponse.json({ success: true, message: t('Update Success') });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    customLogger.error('Failed to update integration', { requestId, error: errorMessage });
    return NextResponse.json({ error: `${t('Error Title')}: ${errorMessage}` }, { status: 500 });
  }
}