import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import VerificationCode from '@/lib/db/models/verification-code.model';
import { auth } from '@/auth';
import { sendNotification } from '@/lib/utils/notification';
import { logger } from '@/lib/api/services/logging';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await req.json();
    const verification = await VerificationCode.findOne({
      userId: session.user.id,
      code,
      type: '2fa',
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      logger.warn('Invalid or expired 2FA code', { userId: session.user.id, code });
      return NextResponse.json({ success: false, error: 'Invalid or expired code' }, { status: 400 });
    }

    verification.used = true;
    await verification.save();

    // Send notification for successful 2FA verification
    await sendNotification({
      userId: session.user.id,
      type: 'verification',
      title: '2FA Verification Successful',
      message: 'Your two-factor authentication code was successfully verified.',
      channels: ['email', 'in_app'],
      data: { verificationType: '2fa' },
    });

    logger.info('2FA verification successful', { userId: session.user.id });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('2FA verification error:', error);
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 });
  }
}