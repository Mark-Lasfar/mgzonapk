// /app/api/product/view/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import { triggerWebhook } from '@/lib/actions/webhook.actions';
import { logger } from '@/lib/services/logging';
import { getTranslations } from 'next-intl/server';

export async function POST(request: Request) {
  const t = await getTranslations('Product');
  try {
    const { productId } = await request.json();
    if (!productId) {
      return NextResponse.json({ success: false, error: t('MissingProductId') }, { status: 400 });
    }

    await connectToDatabase();
    await Product.findByIdAndUpdate(productId, {
      $inc: { 'metrics.views': 1 },
      updatedAt: new Date(),
    });
    await triggerWebhook({
      event: 'product.viewed',
      payload: { productId, timestamp: new Date().toISOString() },
    });

    return NextResponse.json({ success: true, message: t('ProductViewTracked') });
  } catch (error) {
    logger.error(`Error tracking product view`, error);
    return NextResponse.json({ success: false, error: t('Error') }, { status: 500 });
  }
}