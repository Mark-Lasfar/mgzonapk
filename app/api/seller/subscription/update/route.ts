import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTranslations, getLocale } from 'next-intl/server';
import { updateSellerSubscription } from '@/lib/actions/seller.actions';
import { z } from 'zod';

const subscriptionUpdateSchema = z.object({
  plan: z.string().min(1),
  pointsToRedeem: z.number().min(0).optional(),
  paymentMethod: z.string().optional(),
  currency: z.string().optional(),
  market: z.string().optional(),
  trialMonthsUsed: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'subscriptions' });
    const userSession = await auth();

    if (!userSession?.user?.id) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    const data = await request.json();
    const parsedData = subscriptionUpdateSchema.parse(data);

    const result = await updateSellerSubscription(userSession.user.id, parsedData, locale);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error, code: result.code },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: t('messages.subscriptionUpdated'),
      data: result.data,
    });
  } catch (error) {
    console.error('Subscription update error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}