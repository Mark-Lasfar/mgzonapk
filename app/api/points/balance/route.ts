import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPointsBalance } from '@/lib/actions/points.actions';
import { getTranslations } from 'next-intl/server';
import { v4 as uuidv4 } from 'uuid';

// دالة sendLog لإرسال اللوج إلى /api/log
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
  const t = await getTranslations('points.balance');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await sendLog('error', t('Unauthorized'), { requestId });
      return NextResponse.json({ success: false, error: t('Unauthorized') }, { status: 401 });
    }

    const balance = await getPointsBalance(session.user.id);
    await sendLog('info', 'Points balance fetched successfully', {
      requestId,
      userId: session.user.id,
      balance,
    });

    return NextResponse.json({ success: true, data: balance });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Server error');
    await sendLog('error', 'Failed to fetch points balance', {
      requestId,
      userId: session?.user?.id,
      error: errorMessage,
    });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}