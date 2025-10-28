// /app/api/seller/developer-clients/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
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

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.seller.clients');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized access to developer clients', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';
    const slug = searchParams.get('slug');
    const category = searchParams.get('category');
    const searchQuery = searchParams.get('searchQuery');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const minRating = parseFloat(searchParams.get('minRating') || '0');
    const minInstalls = parseInt(searchParams.get('minInstalls') || '0', 10);

    const cacheKey = `clients:${session.user.id}:${slug || 'all'}:${category || 'all'}:${page}:${limit}:${sandbox}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        await customLogger.info('Developer clients retrieved from cache', {
          requestId,
          userId: session.user.id,
          service: 'api',
        });
        return NextResponse.json({
          success: true,
          data: cached,
          requestId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const query: any = { status: 'approved', isActive: true, isMarketplaceApp: true };

    if (slug) {
      query.slug = slug;
    }

    if (category && category !== 'all') {
      query.categories = category;
    }

    if (searchQuery) {
      query.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    if (minRating > 0) {
      query.rating = { $gte: minRating };
    }

    if (minInstalls > 0) {
      query.installs = { $gte: minInstalls };
    }

    const skip = (page - 1) * limit;

    const clients = await Client.find(query)
      .skip(skip)
      .limit(limit)
      .lean()
      .select('name logoUrl description categories features redirectUris scopes customScopes clientId slug status rating ratingsCount installs videos images buttons');

    const clientsWithConnection = await Promise.all(
      clients.map(async (client) => {
        const integration = await SellerIntegration.findOne({
          sellerId: session.user.id,
          integrationId: client._id,
          sandbox,
        }).lean();
        return {
          ...client,
          connected: !!integration,
          status: integration ? integration.status || 'connected' : 'disconnected',
        };
      })
    );

    const totalClients = await Client.countDocuments(query);

    const data = {
      clients: clientsWithConnection,
      pagination: {
        page,
        limit,
        total: totalClients,
        totalPages: Math.ceil(totalClients / limit),
      },
    };

    if (redis) {
      await redis.set(cacheKey, data, { ex: 300 }); // Cache for 5 minutes
    }

    await customLogger.info('Developer clients retrieved successfully', {
      requestId,
      userId: session.user.id,
      count: clientsWithConnection.length,
      page,
      limit,
      sandbox,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to retrieve developer clients', {
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