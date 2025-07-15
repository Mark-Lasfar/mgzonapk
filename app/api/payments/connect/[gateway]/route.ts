import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import { logger } from '@/lib/api/services/logging';
import { addPaymentGateway } from '@/lib/actions/seller.actions';
import { getTranslations, getLocale } from 'next-intl/server';
import Seller from '@/lib/db/models/seller.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { decrypt } from '@/lib/utils/encryption';
import { z } from 'zod';

const requestSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  clientSecret: z.string().min(1, 'Client Secret is required'),
  sandbox: z.boolean().default(false),
});

export async function POST(req: NextRequest, { params }: { params: { gateway: string } }) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api' });
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: t('errors.unauthorized') }, { status: 401 });
    }

    const { gateway } = params;
    const body = await req.json();
    const { clientId, clientSecret, sandbox } = requestSchema.parse(body);

    await connectToDatabase();

    const isInternal = gateway.toLowerCase() === 'mgpay';
    if (isInternal) {
      const seller = await Seller.findOne({ userId: session.user.id });
      if (!seller) {
        return NextResponse.json({ success: false, error: t('errors.sellerNotFound') }, { status: 404 });
      }
      if (!seller.bankInfo?.verified) {
        return NextResponse.json(
          { success: false, error: t('errors.bankNotVerified') },
          { status: 403 }
        );
      }
    }

    const accountDetails = { clientId, clientSecret };
    const result = await addPaymentGateway(
      session.user.id,
      gateway,
      accountDetails,
      isInternal,
      sandbox,
      locale
    );

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    logger.info('Payment gateway connected', { gateway, userId: session.user.id });
    return NextResponse.json({ success: true, message: t('messages.paymentGatewayAdded') });
  } catch (error) {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api' });
    logger.error('Failed to connect payment gateway', { error: String(error) });
    return NextResponse.json({ success: false, error: t('errors.serverError') }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { gateway: string } }) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'Checkout' });
    const { gateway } = params;
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get('sellerId');

    if (!sellerId) {
      return NextResponse.json({ success: false, error: t('failed to load data') }, { status: 400 });
    }

    await connectToDatabase();
    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: new Types.ObjectId(sellerId),
      providerName: gateway,
      isActive: true,
    });

    if (!sellerIntegration) {
      return NextResponse.json({ success: false, error: t('failed to load data') }, { status: 404 });
    }

    const clientId = sellerIntegration.credentials.get('clientId') ? decrypt(sellerIntegration.credentials.get('clientId')!) : undefined;
    if (!clientId) {
      return NextResponse.json({ success: false, error: t('failed to load data') }, { status: 400 });
    }

    return NextResponse.json({ success: true, clientId });
  } catch (error) {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'Checkout' });
    logger.error('Failed to fetch payment gateway config', { error: String(error) });
    return NextResponse.json({ success: false, error: t('failed to load data') }, { status: 500 });
  }
}