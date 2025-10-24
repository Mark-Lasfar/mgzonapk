import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import Product from '@/lib/db/models/product.model';
import { getSellerByCustomSiteUrl } from '@/lib/actions/seller.actions';
import { getTranslations } from 'next-intl/server';
import crypto from 'crypto';

async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, meta }),
    });
  } catch (err) {
    console.error('Failed to send log:', err);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customSiteUrl = searchParams.get('customSiteUrl');
  const productSlug = searchParams.get('productSlug');
  const userId = searchParams.get('userId');
  const locale = searchParams.get('locale') || 'en';
  const requestId = crypto.randomUUID();
  const t = await getTranslations('seller');

  try {
    await connectToDatabase();

    // Case 1: Fetch seller by userId (authenticated seller only)
    if (userId) {
      const session = await auth();
      if (!session?.user?.id || session.user.id !== userId || session.user.role !== 'SELLER') {
        await sendLog('error', t('Unauthorized'), { requestId, userId });
        return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 401 });
      }

      const seller = await Seller.findOne({ userId }).select(
        'businessName pointsBalance subscription settings email logo'
      );
      if (!seller) {
        await sendLog('error', t('Seller not found'), { requestId, userId });
        return NextResponse.json({ success: false, message: t('Seller not found') }, { status: 404 });
      }
      await sendLog('info', t('Seller fetched by userId'), { requestId, userId });
      return NextResponse.json({ success: true, data: seller });
    }

    // Case 2: Fetch seller by customSiteUrl
    if (customSiteUrl) {
      const sellerResponse = await getSellerByCustomSiteUrl(customSiteUrl, locale);
      if (!sellerResponse.success || !sellerResponse.data) {
        await sendLog('error', t('Seller not found for customSiteUrl'), { requestId, customSiteUrl });
        return NextResponse.json({ success: false, message: t('Seller not found') }, { status: 404 });
      }
      await sendLog('info', t('Seller fetched by customSiteUrl'), { requestId, customSiteUrl });
      return NextResponse.json({ success: true, data: sellerResponse.data });
    }

    // Case 3: Fetch seller by productSlug
    if (productSlug) {
      const product = await Product.findOne({ slug: productSlug, isPublished: true, status: 'active' }).lean();
      if (!product) {
        await sendLog('error', t('Product not found'), { requestId, productSlug });
        return NextResponse.json({ success: false, message: t('Product not found') }, { status: 404 });
      }
      const sellerResponse = await getSellerByCustomSiteUrl(product.sellerId, locale);
      if (!sellerResponse.success || !sellerResponse.data) {
        await sendLog('error', t('Seller not found for product'), { requestId, productSlug, sellerId: product.sellerId });
        return NextResponse.json({ success: false, message: t('Seller not found') }, { status: 404 });
      }
      await sendLog('info', t('Seller fetched by product slug'), { requestId, productSlug });
      return NextResponse.json({ success: true, data: sellerResponse.data });
    }

    // Case 4: No valid parameters provided
    await sendLog('error', t('Invalid request parameters'), { requestId });
    return NextResponse.json({ success: false, message: t('Invalid request parameters') }, { status: 400 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Server error');
    await sendLog('error', t('Failed to fetch seller'), { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}