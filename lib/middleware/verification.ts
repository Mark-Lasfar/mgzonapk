import { NextRequest, NextResponse } from 'next/server';
import { validation } from '@/lib/utils/validation';
import User from '@/lib/db/models/user.model';
import { EMAIL_CONFIG } from '@/lib/config/email';

export async function checkVerificationAttempts(
  email: string
): Promise<NextResponse | null> {
  const user = await User.findOne({ email });
  
  if (!user) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  const lastAttempt = user.lastVerificationAttempt;
  const attempts = user.verificationAttempts || 0;

  const { valid, timeRemaining } = validation.validateVerificationAttempts(
    attempts,
    lastAttempt
  );

  if (!valid) {
    return NextResponse.json(
      {
        error: 'Too many attempts',
        timeRemaining,
        cooldown: Math.ceil(EMAIL_CONFIG.VERIFICATION_COOLDOWN / 1000)
      },
      { status: 429 }
    );
  }

  return null;
}

export async function updateVerificationAttempts(email: string): Promise<void> {
  const now = new Date();
  await User.findOneAndUpdate(
    { email },
    {
      $inc: { verificationAttempts: 1 },
      lastVerificationAttempt: now
    }
  );
}

export async function resetVerificationAttempts(email: string): Promise<void> {
  await User.findOneAndUpdate(
    { email },
    {
      verificationAttempts: 0,
      lastVerificationAttempt: null
    }
  );
}