import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import Subscription from '@/lib/db/models/subscription.model';
import Seller from '@/lib/db/models/seller.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { encrypt } from '@/lib/utils/encryption';
import { getTranslations } from 'next-intl/server';
import mongoose from 'mongoose';

const registerSchema = z.object({
  data: z.record(z.any()),
  settings: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string; provider: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('integrations');
  const { id: sellerId, provider } = params;
  const sandbox = req.nextUrl.searchParams.get('sandbox') === 'true';

  try {
    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      logger.warn('Invalid seller ID', { requestId, sellerId });
      return NextResponse.json({ error: t('invalid_seller') }, { status: 400 });
    }

    await connectToDatabase(sandbox ? 'sandbox' : 'live');
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      logger.warn('Seller not found', { requestId, sellerId });
      return NextResponse.json({ error: t('seller_not_found') }, { status: 404 });
    }

    const integration = await Integration.findOne({ providerName: provider, sandbox });
    if (!integration) {
      logger.warn('Integration not found', { requestId, provider, sandbox });
      return NextResponse.json({ error: t('integration_not_found') }, { status: 404 });
    }

    if (!integration.isActive) {
      logger.warn('Integration is not active', { requestId, provider, sandbox });
      return NextResponse.json({ error: t('integration_not_active') }, { status: 400 });
    }

    if (!integration.autoRegister?.enabled) {
      logger.warn('Auto-register is not enabled for this integration', { requestId, provider, sandbox });
      return NextResponse.json({ error: t('auto_register_not_enabled') }, { status: 400 });
    }

    // التحقق من الاشتراك المطلوب
    if (!integration.pricing.isFree && integration.pricing.requiredPlanIds?.length) {
      const subscription: mongoose.Document | null = await Subscription.findOne({
        sellerId,
        planId: { $in: integration.pricing.requiredPlanIds },
        status: 'active',
        expiryDate: { $gt: new Date() },
      });
      if (!subscription) {
        logger.warn('No active subscription for required plan', { requestId, sellerId, provider });
        return NextResponse.json({ error: t('subscription_required') }, { status: 403 });
      }
    }

    const body = await req.json();
    const { data, settings } = registerSchema.parse(body);

    // التحقق من الحقول المطلوبة
    const requiredFields = integration.autoRegister?.fields?.filter((f) => f.required) || [];
    for (const field of requiredFields) {
      if (!(field.key in data)) {
        logger.warn('Missing required field', { requestId, field: field.key });
        return NextResponse.json({ error: t('missing_required_field', { field: field.label }) }, { status: 400 });
      }
    }

    // تشفير البيانات الحساسة
    const encryptedData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, encrypt(String(value))])
    );

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const existingIntegration = await SellerIntegration.findOne({
        sellerId,
        integrationId: integration._id,
        sandbox,
      }).session(session);

      if (existingIntegration) {
        logger.warn('Integration already registered', { requestId, sellerId, provider });
        await session.abortTransaction();
        return NextResponse.json({ error: t('already_registered') }, { status: 400 });
      }

      await SellerIntegration.create(
        [
          {
            sellerId,
            integrationId: integration._id,
            isActive: true,
            sandbox,
            data: encryptedData,
            settings,
            connectedBy: sellerId,
            connectedByRole: 'seller',
            connectionType: 'auto',
            history: [{ event: 'registered', date: new Date() }],
          },
        ],
        { session }
      );

      await session.commitTransaction();
      logger.info('Integration registered successfully', { requestId, sellerId, provider, sandbox });
      return NextResponse.json({ success: true, message: t('registration_success') });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to register integration', { requestId, sellerId, provider, error: errorMessage });
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: t('invalid_data'), details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: t('error', { message: errorMessage }) }, { status: 500 });
  }
}