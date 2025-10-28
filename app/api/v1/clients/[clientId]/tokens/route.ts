// /home/mark/Music/my-nextjs-project-clean/app/api/v1/clients/[clientId]/tokens/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import ClientToken from '@/lib/db/models/client-token.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import crypto from 'crypto';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ clientId: string }> } // params الآن Promise
) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');

  try {
    await connectToDatabase('live');
    const session = await auth();

    if (!session?.user?.id) {
      await customLogger.error('Unauthorized access to tokens', {
        requestId,
        service: 'api',
      });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    // فك Promise للحصول على clientId
    const { clientId } = await context.params;

    // تحقق من أن العميل موجود ويخص المستخدم الحالي
    const client = await ClientToken.findOne({ clientId, createdBy: session.user.id });
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

    // استرجاع التوكنات الخاصة بالعميل
    const tokens = await ClientToken.find({ clientId, userId: session.user.id }).lean();

    await customLogger.info('Tokens retrieved successfully', {
      requestId,
      clientId,
      userId: session.user.id,
      count: tokens.length,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: tokens.map((token) => ({
        id: token._id,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
      })),
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to retrieve tokens', {
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
  context: { params: Promise<{ clientId: string }> } // params عبارة عن Promise
) {
  const requestId = crypto.randomUUID();
  const t = await getTranslations('api.clients');

  try {
    await connectToDatabase('live');
    const session = await auth();

    if (!session?.user?.id) {
      await customLogger.error('Unauthorized token deletion', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { clientId } = await context.params; // فك Promise

    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json(
        { success: false, error: t('tokenIdRequired'), requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const result = await ClientToken.deleteOne({
      _id: tokenId,
      clientId,
      userId: session.user.id,
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: t('tokenNotFound'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    await customLogger.info('Token deleted successfully', {
      requestId,
      userId: session.user.id,
      clientId,
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
