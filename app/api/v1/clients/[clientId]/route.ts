import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { encrypt } from '@/lib/utils/encryption';
import { RedisClient } from '@/lib/api/services/redis';

const clientUpdateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  redirectUris: z.array(z.string().url()).min(1).optional(),
  scopes: z.array(z.string()).min(1).optional(),
  customScopes: z.array(z.string().regex(/^[a-zA-Z0-9:]+$/)).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  videos: z.array(
    z.object({
      url: z.string().url(),
      position: z.enum(['left', 'center', 'right']).default('center'),
      size: z.enum(['small', 'medium', 'large']).default('medium'),
    })
  ).optional(),
  images: z.array(
    z.object({
      url: z.string().url(),
      position: z.enum(['left', 'center', 'right']).default('center'),
      size: z.enum(['small', 'medium', 'large']).default('medium'),
    })
  ).optional(),
  buttons: z.array(
    z.object({
      label: z.string().min(2),
      link: z.string().url(),
      type: z.enum(['primary', 'secondary', 'link']).default('primary'),
    })
  ).optional(),
  features: z.array(z.string().max(200)).optional(),
  categories: z.array(
    z.enum([
      'payment',
      'warehouse',
      'dropshipping',
      'marketplace',
      'shipping',
      'marketing',
      'accounting',
      'crm',
      'analytics',
      'automation',
      'communication',
      'education',
      'security',
      'advertising',
      'tax',
      'other',
    ])
  ).optional(),
  isMarketplaceApp: z.boolean().optional(),
  pricing: z
    .object({
      model: z.enum(['free', 'one-time', 'subscription']).default('free'),
      amount: z.number().min(0).optional(),
      currency: z.enum(['USD', 'SAR', 'EGP']).default('USD').optional(),
      interval: z.enum(['monthly', 'yearly']).optional(),
    })
    .optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> } // params لازم تكون Promise
) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');

  try {
    await connectToDatabase('live');

    // استخرج clientId بشكل صحيح
    const { clientId } = await context.params;

    const client = await Client.findOne({ clientId })
      .lean()
      .select(
        'name redirectUris scopes customScopes description logoUrl videos images buttons features categories slug status isMarketplaceApp pricing'
      );

    if (!client) {
      await customLogger.error('Client not found', {
        requestId,
        clientId,
        service: 'api',
      });
      return NextResponse.json(
        { success: false, error: t('clientNotFound'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    await customLogger.info('Client retrieved successfully', {
      requestId,
      clientId,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: {
        name: client.name,
        redirectUris: client.redirectUris,
        scopes: client.scopes,
        customScopes: client.customScopes,
        description: client.description,
        logoUrl: client.logoUrl,
        videos: client.videos,
        images: client.images,
        buttons: client.buttons,
        features: client.features,
        categories: client.categories,
        slug: client.slug,
        status: client.status,
        isMarketplaceApp: client.isMarketplaceApp,
        pricing: client.pricing,
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


export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> } // params لازم تكون Promise
) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized client update', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    // استخرج clientId بشكل صحيح
    const { clientId } = await context.params;

    await connectToDatabase('live');
    const client = await Client.findOne({ clientId, createdBy: session.user.id });
    if (!client) {
      await customLogger.error('Client not found or unauthorized', {
        requestId,
        clientId,
        userId: session.user.id,
        service: 'api',
      });
      return NextResponse.json(
        { success: false, error: t('clientNotFound'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'regenerate-secret') {
      const randomString = crypto.randomUUID();
      client.clientSecret = encrypt(randomString);
      client.updatedBy = session.user.id;
      client.updatedAt = new Date();
      await client.save();

      await RedisClient.del(`clients:${session.user.id}`);

      await customLogger.info('Client secret regenerated', {
        requestId,
        userId: session.user.id,
        clientId,
        service: 'api',
      });

      return NextResponse.json({
        success: true,
        data: { clientId: client.clientId, clientSecret: client.clientSecret },
        requestId,
        timestamp: new Date().toISOString(),
      });
    }

    const body = await req.json();
    const validatedData = clientUpdateSchema.parse(body);

    Object.assign(client, {
      ...validatedData,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    });

    await client.save();
    await RedisClient.del(`clients:${session.user.id}`);

    await customLogger.info('Client updated successfully', {
      requestId,
      userId: session.user.id,
      clientId,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: {
        clientId: client.clientId,
        name: client.name,
        redirectUris: client.redirectUris,
        scopes: client.scopes,
        customScopes: client.customScopes,
        description: client.description,
        logoUrl: client.logoUrl,
        videos: client.videos,
        images: client.images,
        buttons: client.buttons,
        features: client.features,
        categories: client.categories,
        slug: client.slug,
        status: client.status,
        isMarketplaceApp: client.isMarketplaceApp,
        pricing: client.pricing,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to update client', {
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


export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    // فك Promise أولًا للحصول على clientId
    const { clientId } = await context.params;

    // الآن استدعاء getTranslations
    const t = await getTranslations('api.clients');

    await connectToDatabase('live');
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const result = await Client.deleteOne({ clientId, createdBy: session.user.id });
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: t('clientNotFound'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    await customLogger.info('Client deleted successfully', {
      requestId,
      userId: session.user.id,
      clientId,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      message: 'Client deleted successfully',
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const t = await getTranslations('api.clients'); // fallback
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to delete client', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

