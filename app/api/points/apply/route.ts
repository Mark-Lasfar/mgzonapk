import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { redeemPoints } from '@/lib/actions/points.actions';
import { getTranslations } from 'next-intl/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Schema للتحقق من بيانات الـ POST
const redeemPointsSchema = z.object({
  points: z.number().min(1, 'Points must be at least 1'),
  currency: z.string().min(1, 'Currency is required'),
});

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
  const t = await getTranslations('points.apply');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await sendLog('error', t('Unauthorized'), { requestId });
      return NextResponse.json({ success: false, error: t('Unauthorized') }, { status: 401 });
    }

    const body = await req.json();
    const { points, currency } = redeemPointsSchema.parse(body);

    const discount = await redeemPoints(session.user.id, points, currency, 'Points redeemed via API');
    await sendLog('info', 'Points redeemed successfully', {
      requestId,
      userId: session.user.id,
      points,
      currency,
      discount,
    });

    return NextResponse.json({ success: true, data: { discount } });
  } catch (error) {
    const errorMessage = error instanceof z.ZodError
      ? error.errors.map((e) => e.message).join(', ')
      : error instanceof Error
      ? error.message
      : t('Server error');
    await sendLog('error', 'Failed to redeem points', {
      requestId,
      userId: session?.user?.id,
      error: errorMessage,
    });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}