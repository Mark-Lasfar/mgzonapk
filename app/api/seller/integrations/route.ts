// /app/api/seller/integrations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import mongoose from 'mongoose';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { getTranslations } from 'next-intl/server';

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('seller integrations');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: t('Unauthorized') }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const provider = searchParams.get('provider');

    await connectToDatabase(sandbox ? 'sandbox' : 'live');
    const query: any = { isActive: true };
    if (type) query.type = type;
    if (provider) query.providerName = { $regex: provider, $options: 'i' };

    const data = await Integration.aggregate([
      { $match: query },
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
                    ...(status ? [{ $eq: ['$status', status] }] : []),
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
          features: 1,
          categories: 1,
          rating: 1,
          ratingsCount: 1,
          installs: 1,
          slug: 1,
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

    customLogger.info('Integrations fetched successfully', { requestId, userId: session.user.id, sandbox });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    customLogger.error('Failed to fetch integrations', { requestId, error: errorMessage });
    return NextResponse.json({ error: `${t('Error Title')}: ${errorMessage}` }, { status: 500 });
  }
}