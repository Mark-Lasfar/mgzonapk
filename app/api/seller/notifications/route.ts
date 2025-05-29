import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { NotificationUtils } from '@/lib/utils/notification';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json(
        { success: false, message: 'غير مصرح' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = parseInt(searchParams.get('skip') || '0', 10);

    const notifications = await NotificationUtils.getUserNotifications(
      session.user.id,
      limit,
      skip
    );

    return NextResponse.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error('خطأ في API:', error);
    return NextResponse.json(
      { success: false, message: 'خطأ داخلي في السيرفر' },
      { status: 500 }
    );
  }
}