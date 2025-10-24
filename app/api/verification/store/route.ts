// /app/api/verification/store/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import VerificationCode from '@/lib/db/models/verification-code.model';
import { getTranslations } from 'next-intl/server';

export async function POST(request: Request) {
  const t = await getTranslations('Auth');
  try {
    const { userId, email, code } = await request.json();
    if (!userId || !email || !code) {
      return NextResponse.json({ success: false, error: t('MissingFields') }, { status: 400 });
    }

    await connectToDatabase();
    const expiryMs = parseInt(process.env.VERIFICATION_CODE_EXPIRY || '600000'); // default to 10 mins
    const expiresAt = new Date(Date.now() + expiryMs);

    await VerificationCode.create({
      userId,
      email,
      code,
      type: 'EMAIL_VERIFICATION',
      expiresAt,
    });

    return NextResponse.json({ success: true, message: t('VerificationCodeStored') });
  } catch (error) {
    console.error('Error storing verification code:', error);
    return NextResponse.json({ success: false, error: t('Error') }, { status: 500 });
  }
}