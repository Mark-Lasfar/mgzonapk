import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
// import ClientToken from '@/lib/db/models/client-token.model';

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
  isMarketplaceApp: z.boolean().default(false),
  pricing: z
    .object({
      model: z.enum(['free', 'one-time', 'subscription']).default('free'),
      amount: z.number().min(0, 'السعر يجب أن يكون رقمًا إيجابيًا').optional(),
      currency: z.enum(['USD', 'SAR', 'EGP']).default('USD').optional(),
      interval: z.enum(['monthly', 'yearly']).optional(),
    })
    .refine(
      (data) => data.model === 'free' || (data.amount !== undefined && data.amount > 0),
      { message: 'السعر مطلوب لنماذج الدفع أو الاشتراك', path: ['amount'] }
    )
    .refine(
      (data) => data.model !== 'subscription' || (data.interval !== undefined),
      { message: 'الفترة مطلوبة لنموذج الاشتراك', path: ['interval'] }
    )
    .optional(),
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
          // تأكد من تحويل النص المخزن في Redis إلى JSON
          return NextResponse.json({
            success: true,
            data: typeof cached === 'string' ? JSON.parse(cached) : cached,
            requestId,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (redisError) {
        await customLogger.error('Failed to retrieve from Redis', {
          requestId,
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
          service: 'api',
        });
      }
    }

    // جلب العملاء من قاعدة البيانات
    await connectToDatabase(); 
    const clients = await Client.find({ createdBy: session.user.id })
      .lean()
      .select(
        'name clientId clientSecret redirectUris scopes description logoUrl videos images buttons features categories slug createdAt status isMarketplaceApp pricing'
      );

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
        await redis.set(cacheKey, JSON.stringify(data), { ex: 300 }); // Cache for 5 minutes
      } catch (redisError) {
        await customLogger.error('Failed to store in Redis', {
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

  try {
    const t = await getTranslations('api.clients'); // الآن داخل try

    await connectToDatabase();
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
      isMarketplaceApp: validatedData.isMarketplaceApp || false,
      slug: validatedData.slug || validatedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      pricing: validatedData.pricing,
    });

    if (redis) {
      await redis.del(`clients:${session.user.id}`); // Clear cache
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
        isMarketplaceApp: client.isMarketplaceApp,
        pricing: client.pricing,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const t = await getTranslations('api.clients'); // fallback للـ catch
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


export async function DELETE(
  req: NextRequest,
  { params }: { params: { clientId: string } }
) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');

  try {
    await connectToDatabase();
    const session = await auth();

    if (!session?.user?.id) {
      await customLogger.error('Unauthorized token deletion', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: t('tokenIdRequired'), requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // تحقق من أن العميل موجود ويخص المستخدم الحالي
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

    // حذف التوكن من قاعدة البيانات
    const result = await Client.updateOne(
      { clientId: params.clientId, createdBy: session.user.id },
      { $pull: { tokens: { _id: tokenId } } } // نفترض أن التوكن مخزن كمصفوفة tokens داخل العميل
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, error: t('tokenNotFound'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // مسح الكاش في Redis إذا موجود
    if (redis) {
      try {
        await redis.del(`clients:${session.user.id}`);
      } catch (redisError) {
        await customLogger.error('Failed to clear Redis cache after token deletion', {
          requestId,
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
          service: 'api',
        });
      }
    }

    await customLogger.info('Token deleted successfully', {
      requestId,
      userId: session.user.id,
      clientId: params.clientId,
      tokenId,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to delete token', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
