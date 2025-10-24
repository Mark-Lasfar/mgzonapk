// /home/mark/Music/my-nextjs-project-clean/app/api/notifications/remind/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const notificationSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  channels: z.array(z.string()),
  priority: z.string(),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      customLogger.warn('Unauthorized_access', { requestId });
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsedData = notificationSchema.safeParse(body);
    if (!parsedData.success) {
      customLogger.warn('Invalid_notification_data', { requestId, errors: parsedData.error.issues });
      return NextResponse.json(
        { success: false, message: 'Invalid notification data', errors: parsedData.error.issues },
        { status: 400 }
      );
    }

    const { orderId, userId, type, title, message, channels, priority } = parsedData.data;

    // هنا يمكنك تنفيذ منطق إرسال الإشعار (مثل إرسال بريد إلكتروني أو إشعار داخل التطبيق)
    // على سبيل المثال، محاكاة إرسال الإشعار
    console.log(`Sending notification: ${type} to user ${userId} for order ${orderId}`);

    customLogger.info('Notification_sent', { requestId, orderId, userId, type });
    return NextResponse.json({ success: true, message: 'Notification sent' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Server error';
    customLogger.error('Failed_to_send_notification', { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}