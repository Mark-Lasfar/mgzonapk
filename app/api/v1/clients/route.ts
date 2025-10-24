import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN,
    })
  : null;

const clientSchema = z.object({
  name: z.string().min(2, 'اسم التطبيق يجب أن يكون 2 أحرف على الأقل').max(100),
  redirectUris: z.array(z.string().url('رابط إعادة التوجيه غير صالح')).min(1, 'مطلوب رابط إعادة توجيه واحد على الأقل'),
  scopes: z.array(z.string()).min(1, 'مطلوب نطاق واحد على الأقل'),
  customScopes: z.array(z.string()).optional(),
  description: z.string().max(500, 'الوصف لا يمكن أن يتجاوز 500 حرف').optional(),
  logoUrl: z.string().url('رابط الشعار غير صالح').optional().or(z.literal('')),
  videos: z
    .array(
      z.object({
        url: z.string().url('رابط الفيديو غير صالح'),
        position: z.enum(['left', 'center', 'right']).default('center'),
        size: z.enum(['small', 'medium', 'large']).default('medium'),
      })
    )
    .optional(),
  images: z
    .array(
      z.object({
        url: z.string().url('رابط الصورة غير صالح'),
        position: z.enum(['left', 'center', 'right']).default('center'),
        size: z.enum(['small', 'medium', 'large']).default('medium'),
      })
    )
    .optional(),
  buttons: z
    .array(
      z.object({
        label: z.string().min(2, 'نص الزر يجب أن يكون 2 أحرف على الأقل'),
        link: z.string().url('رابط الزر غير صالح'),
        type: z.enum(['primary', 'secondary', 'link']).default('primary'),
      })
    )
    .optional(),
  features: z.array(z.string().max(200, 'الميزة لا يمكن أن تتجاوز 200 حرف')).optional(),
  categories: z
    .array(
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
    )
    .optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'معرف غير صالح').optional(),
});

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized access to clients', {
        requestId,
        service: 'api',
        headers: Object.fromEntries(req.headers),
      });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const cacheKey = `clients:${session.user.id}`;
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          await customLogger.info('Clients retrieved from cache', {
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
      } catch (redisError) {
        customLogger.error('Failed to retrieve from Redis', {
          requestId,
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
          service: 'api',
        });
      }
    }

    try {
      await connectToDatabase('live'); // Use 'live' mode
      const clients = await Client.find({ createdBy: session.user.id })
        .lean()
        .select('name clientId clientSecret redirectUris scopes description logoUrl videos images buttons features categories slug createdAt status');

      const data = {
        clients,
        pagination: {
          page: 1,
          limit: clients.length,
          total: clients.length,
          totalPages: 1,
        },
      };

      if (redis) {
        try {
          await redis.set(cacheKey, data, { ex: 300 }); // Cache for 5 minutes
        } catch (redisError) {
          customLogger.error('Failed to store in Redis', {
            requestId,
            error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
            service: 'api',
          });
        }
      }

      await customLogger.info('Clients retrieved successfully', {
        requestId,
        userId: session.user.id,
        count: clients.length,
        service: 'api',
      });

      return NextResponse.json({
        success: true,
        data,
        requestId,
        timestamp: new Date().toISOString(),
      });
    } catch (dbError) {
      const errorMessage = dbError instanceof Error ? dbError.message : t('unknown_error');
      await customLogger.error('Database error while retrieving clients', {
        requestId,
        error: errorMessage,
        service: 'api',
      });
      throw new Error(errorMessage);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to retrieve clients', {
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

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');
  try {
    await connectToDatabase('live'); // Use 'live' mode
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized client creation', {
        requestId,
        service: 'api',
        headers: Object.fromEntries(req.headers),
      });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validatedData = clientSchema.parse(body);

    const client = await Client.create({
      ...validatedData,
      clientId: `mgzon_${crypto.randomBytes(16).toString('hex')}`,
      clientSecret: crypto.randomBytes(32).toString('hex'),
      createdBy: session.user.id,
      updatedBy: session.user.id,
      isActive: true,
      status: 'pending',
      slug: validatedData.slug || validatedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    });

    if (redis) {
      try {
        await redis.del(`clients:${session.user.id}`); // Invalidate cache
      } catch (redisError) {
        customLogger.error('Failed to invalidate Redis cache', {
          requestId,
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
          service: 'api',
        });
      }
    }

    await customLogger.info('Client created successfully', {
      requestId,
      userId: session.user.id,
      clientId: client.clientId,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: {
        clientId: client.clientId,
        clientSecret: client.clientSecret,
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
        createdAt: client.createdAt,
        status: client.status,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to create client', {
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