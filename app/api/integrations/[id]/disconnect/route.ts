import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('api.integrations.disconnect');
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const authSession = await auth();
    if (!authSession?.user?.id || authSession.user.role !== 'SELLER') {
      await customLogger.error('Unauthorized access to disconnect integration', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: authSession.user.id,
      integrationId: params.id,
      sandbox,
    }).session(session);

    if (!sellerIntegration) {
      await customLogger.error('Integration not found', { requestId, integrationId: params.id, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('not_found'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    sellerIntegration.isActive = false;
    sellerIntegration.status = 'disconnected';
    sellerIntegration.history.push({ event: 'disconnected', date: new Date() });
    await sellerIntegration.save({ session });

    await session.commitTransaction();
    await customLogger.info('Integration disconnected successfully', {
      requestId,
      integrationId: params.id,
      sellerId: authSession.user.id,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      message: t('disconnected'),
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await session.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to disconnect integration', {
      requestId,
      error: errorMessage,
      service: 'api',
    });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}