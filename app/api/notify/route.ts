'use server';

import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '@/lib/utils/notification';
import { logger } from '@/lib/api/services/logging'; // Adjust path if logger is elsewhere

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, type, title, message, data, channels } = body;

    const result = await sendNotification({
      userId,
      type,
      title,
      message,
      data,
      channels,
    });

    if (!result.success) {
      console.error('Notification failed', { error: result.error });
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, notificationId: result.notificationId });
  } catch (error) {
    console.error('Notify API error:', error);
    return NextResponse.json({ success: false, error: 'Failed to send notification' }, { status: 500 });
  }
}