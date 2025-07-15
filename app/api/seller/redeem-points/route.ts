import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Seller from '@/lib/db/models/seller.model';
import { connectToDatabase } from '@/lib/db';
import { getTranslations } from 'next-intl/server';

export async function POST(req: NextRequest) {
  const t = await getTranslations({ locale: 'en', namespace: 'api' });
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    const { points, currency, description } = await req.json();
    if (!points || !currency || !description || points <= 0) {
      return NextResponse.json(
        { success: false, message: t('errors.invalidData') },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    if (seller.pointsBalance < points) {
      return NextResponse.json(
        { success: false, message: t('errors.insufficientPoints') },
        { status: 400 }
      );
    }

    seller.pointsBalance -= points;
    seller.pointsHistory.push({
      amount: points,
      type: 'debit',
      reason: description,
      createdAt: new Date(),
    });
    await seller.save();

    return NextResponse.json({
      success: true,
      data: { pointsBalance: seller.pointsBalance },
      message: t('messages.pointsRedeemed'),
    });
  } catch (error) {
    console.error('Redeem points error:', error);
    return NextResponse.json(
      { success: false, message: t('errors.internalServerError') },
      { status: 500 }
    );
  }
}