import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { getTranslations } from 'next-intl/server';
import { v4 as uuidv4 } from 'uuid';

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

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('api');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await sendLog('error', t('errors.unauthorized'), { requestId });
      return NextResponse.json({ success: false, error: t('errors.unauthorized') }, { status: 401 });
    }

    const body = await req.json();
    const { id, code, description, discountType, discountValue, minPurchase, validUntil } = body;

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      await sendLog('error', t('errors.sellerNotFound'), { requestId, userId: session.user.id });
      return NextResponse.json({ success: false, error: t('errors.sellerNotFound') }, { status: 404 });
    }

    seller.discountOffers = seller.discountOffers || [];
    seller.discountOffers.push({
      id: id || uuidv4(),
      code,
      description,
      discountType,
      discountValue,
      minPurchase: minPurchase || 0,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      isActive: true,
    });

    await seller.save();
    await sendLog('info', 'Coupon created successfully', {
      requestId,
      userId: session.user.id,
      couponId: id,
    });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('errors.internalServerError');
    await sendLog('error', 'Failed to create coupon', {
      requestId,
      userId: session?.user?.id,
      error: errorMessage,
    });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}