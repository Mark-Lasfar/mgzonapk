import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSellerMetrics } from '@/lib/actions/seller.actions';
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

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('api');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await sendLog('error', t('errors.unauthorized'), { requestId });
      return NextResponse.json({ success: false, error: t('errors.unauthorized') }, { status: 401 });
    }

    const metrics = await getSellerMetrics(session.user.id);
    await sendLog('info', 'Seller metrics fetched successfully', {
      requestId,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: metrics });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('errors.internalServerError');
    await sendLog('error', 'Failed to fetch seller metrics', {
      requestId,
      userId: session?.user?.id,
      error: errorMessage,
    });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}