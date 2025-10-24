import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import VerificationCode from '@/lib/db/models/verification-code.model';
import User from '@/lib/db/models/user.model';
import { validation } from '@/lib/utils/validation';
import { sendNotification } from '@/lib/utils/notification';

import { logger } from '@/lib/api/services/logging';
import {
  checkVerificationAttempts,
  updateVerificationAttempts,
  resetVerificationAttempts,
} from '@/lib/middleware/verification';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const { email, code } = await req.json();

    // Validate input
    if (!validation.isValidEmail(email) || !validation.isValidVerificationCode(code)) {
      logger.warn('Invalid email or code format', { email, code });
      return NextResponse.json(
        { success: false, error: 'Invalid email or verification code format' },
        { status: 400 }
      );
    }

    // Check verification attempts
    const attemptsCheck = await checkVerificationAttempts(email);
    if (attemptsCheck) {
      logger.warn('Too many verification attempts', { email });
      return attemptsCheck;
    }

    // Verify code
    const verificationRecord = await VerificationCode.findOne({
      email,
      code,
      type: 'EMAIL_VERIFICATION',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verificationRecord) {
      await updateVerificationAttempts(email);
      logger.warn('Invalid or expired verification code', { email, code });
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification code' },
        { status: 400 }
      );
    }

    // Update verification status
    const user = await User.findOne({ email }).select('id').lean();
    if (!user) {
      logger.error('User not found for email', { email });
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 400 });
    }

    await Promise.all([
      VerificationCode.findByIdAndUpdate(verificationRecord._id, { verified: true }),
      User.findOneAndUpdate(
        { email },
        {
          emailVerified: true,
          isActive: true,
          $unset: { verificationAttempts: '', lastVerificationAttempt: '' },
        }
      ),
      resetVerificationAttempts(email),
    ]);

    // Send notification for successful email verification
    await sendNotification({
      userId: user.id,
      type: 'verification',
      title: 'Email Verification Successful',
      message: 'Your email address has been successfully verified.',
      channels: ['email', 'in_app'],
      data: { verificationType: 'email' },
    });

    logger.info('Email verified successfully', { email });
    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    logger.error('Error verifying email:', error);
    return NextResponse.json(
      { success: false, error: 'Error verifying email' },
      { status: 500 }
    );
  }
}