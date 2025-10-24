import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserNotifications, getUnreadCount } from '@/lib/utils/notification';
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
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const skip = parseInt(searchParams.get('skip') || '0', 10);
  const requestId = crypto.randomUUID();
  const t = await getTranslations('notifications');

  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      await sendLog('error', t('Unauthorized'), { requestId });
      return NextResponse.json(
        { success: false, message: t('Unauthorized') },
        { status: 401 }
      );
    }

    const notifications = await getUserNotifications(session.user.id, limit, skip);
    await sendLog('info', t('Fetched seller notifications'), { requestId, userId: session.user.id, limit, skip, count: notifications.length });

    return NextResponse.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Server error');
    await sendLog('error', t('Failed to fetch notifications'), { requestId, error: errorMessage });
    return NextResponse.json(
      { success: false, message: t('Server error') },
      { status: 500 }
    );
  }
}