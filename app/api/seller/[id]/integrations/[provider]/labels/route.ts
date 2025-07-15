import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import Seller from '@/lib/db/models/seller.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { getTranslations } from 'next-intl/server';
import mongoose from 'mongoose';
import { z } from 'zod';

const labelSchema = z.object({
  orderId: z.string(),
  shippingAddress: z.object({
    name: z.string(),
    street: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    postalCode: z.string(),
    phone: z.string().optional(),
  }),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().min(1),
    })
  ),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; provider: string } }
) {
  const requestId = uuidv4();
  const t = await getTranslations('seller.integrations');
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const authSession = await auth();
    if (!authSession?.user?.id || authSession.user.role !== 'SELLER') {
      return NextResponse.json({ error: t('unauthorized') }, { status: 401 });
    }

    const { id: sellerId, provider } = params;
    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return NextResponse.json({ error: t('invalid_seller_id') }, { status: 400 });
    }

    const body = await req.json();
    const validatedData = labelSchema.parse(body);

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const seller = await Seller.findById(sellerId).session(session);
    if (!seller) {
      return NextResponse.json({ error: t('seller_not_found') }, { status: 404 });
    }

    const integration = await Integration.findOne({ providerName: provider }).session(session);
    if (!integration || !integration.isActive) {
      return NextResponse.json({ error: t('integration_not_found') }, { status: 404 });
    }

    const sellerIntegration = await SellerIntegration.findOne({
      sellerId,
      integrationId: integration._id,
      sandbox,
    }).session(session);

    if (!sellerIntegration || !sellerIntegration.isActive || !sellerIntegration.credentials) {
      return NextResponse.json({ error: t('not_connected') }, { status: 404 });
    }

    const apiUrl = integration.apiEndpoints?.labels || integration.credentials.apiUrl;
    const response = await fetch(`${apiUrl}/labels`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sellerIntegration.credentials.apiKey}`,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      throw new Error('Failed to generate shipping label');
    }

    const labelData = await response.json();
    logger.info('Shipping label generated', { requestId, sellerId, provider, orderId: validatedData.orderId });
    await session.commitTransaction();
    return NextResponse.json({ success: true, data: labelData });
  } catch (error) {
    await session.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to generate shipping label', { requestId, error: errorMessage });
    return NextResponse.json({ error: t('server_error') }, { status: 500 });
  } finally {
    session.endSession();
  }
}