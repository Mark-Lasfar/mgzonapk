import { NextRequest, NextResponse } from 'next/server';
import { getTranslations, getLocale } from 'next-intl/server';
import { getCart } from '@/lib/actions/cart.actions';

export async function GET(req: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'Cart' });
    const { searchParams } = new URL(req.url);
    const sellerId = searchParams.get('sellerId');

    if (!sellerId) {
      return NextResponse.json({ success: false, message: t('invalid data') }, { status: 400 });
    }

    const result = await getCart(sellerId, locale);
    if (!result.success || !result.cart) {
      return NextResponse.json({ success: false, message: result.message || t('get cart failed') }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.cart.items });
  } catch (error) {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'Cart' });
    return NextResponse.json({ success: false, message: t('get cart failed') }, { status: 500 });
  }
}