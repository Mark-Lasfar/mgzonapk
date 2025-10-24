import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { sendNotification, getUnreadCount, getUserNotifications, markAsRead, deleteNotification, clearAllNotifications, markAllAsRead } from '@/lib/utils/notification';
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
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');
  const notificationId = searchParams.get('notificationId');
  const limit = parseInt(searchParams.get('limit') || '10', 10);
  const skip = parseInt(searchParams.get('skip') || '0', 10);
  const requestId = crypto.randomUUID();
  const t = await getTranslations('notifications');

  try {
    const session = await auth();
    if (!session?.user?.id) {
      await sendLog('error', t('Unauthorized'), { requestId });
      return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 401 });
    }

    if (action === 'getUnreadCount' && userId) {
      if (session.user.id !== userId && session.user.role !== 'SELLER') {
        await sendLog('error', t('Unauthorized access to notifications'), { requestId, userId });
        return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 403 });
      }
      const count = await getUnreadCount(userId);
      await sendLog('info', t('Fetched unread notifications count'), { requestId, userId, count });
      return NextResponse.json({ success: true, data: count });
    }

    if (action === 'getUserNotifications' && userId) {
      if (session.user.id !== userId && session.user.role !== 'SELLER') {
        await sendLog('error', t('Unauthorized access to notifications'), { requestId, userId });
        return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 403 });
      }
      const notifications = await getUserNotifications(userId, limit, skip);
      await sendLog('info', t('Fetched user notifications'), { requestId, userId, limit, skip, count: notifications.length });
      return NextResponse.json({ success: true, data: notifications });
    }

    await sendLog('error', t('Invalid action'), { requestId, action });
    return NextResponse.json({ success: false, message: t('Invalid action') }, { status: 400 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Server error');
    await sendLog('error', t('Failed to process notification request'), { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const requestId = crypto.randomUUID();
  const t = await getTranslations('notifications');

  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      await sendLog('error', t('Unauthorized'), { requestId });
      return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 401 });
    }

    const { action, userId, notificationId, ...notificationData } = body;

    if (action === 'sendNotification') {
      if (!userId || !notificationData.type || !notificationData.title || !notificationData.message) {
        await sendLog('error', t('Invalid notification data'), { requestId, userId });
        return NextResponse.json({ success: false, message: t('Invalid notification data') }, { status: 400 });
      }
      const result = await sendNotification({ userId, ...notificationData });
      await sendLog('info', t('Notification sent via API'), { requestId, userId, notificationId: result.notificationId });
      return NextResponse.json(result);
    }

    if (action === 'markAsRead' && notificationId) {
      await markAsRead(notificationId);
      await sendLog('info', t('Notification marked as read via API'), { requestId, notificationId });
      return NextResponse.json({ success: true, message: t('Notification marked as read') });
    }

    if (action === 'deleteNotification' && notificationId) {
      await deleteNotification(notificationId);
      await sendLog('info', t('Notification deleted via API'), { requestId, notificationId });
      return NextResponse.json({ success: true, message: t('Notification deleted') });
    }

    if (action === 'clearAllNotifications' && userId) {
      if (session.user.id !== userId) {
        await sendLog('error', t('Unauthorized access to clear notifications'), { requestId, userId });
        return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 403 });
      }
      await clearAllNotifications(userId);
      await sendLog('info', t('All notifications cleared via API'), { requestId, userId });
      return NextResponse.json({ success: true, message: t('All notifications cleared') });
    }

    if (action === 'markAllAsRead' && userId) {
      if (session.user.id !== userId) {
        await sendLog('error', t('Unauthorized access to mark all notifications as read'), { requestId, userId });
        return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 403 });
      }
      await markAllAsRead(userId);
      await sendLog('info', t('All notifications marked as read via API'), { requestId, userId });
      return NextResponse.json({ success: true, message: t('All notifications marked as read') });
    }

    await sendLog('error', t('Invalid action'), { requestId, action });
    return NextResponse.json({ success: false, message: t('Invalid action') }, { status: 400 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Server error');
    await sendLog('error', t('Failed to process notification request'), { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}