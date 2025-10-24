import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import User from '@/lib/db/models/user.model';
import { generateRecoveryCode } from '@/lib/utils/verification';
import { sendNotification } from '@/lib/utils/notification';
// import { sendNotification } from '@/lib/actions/notification.actions';

import VerificationCode from '@/lib/db/models/verification-code.model';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { name, email, password } = await req.json();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ success: false, error: 'Email already exists' }, { status: 400 });
    }

    const user = await User.create({
      name,
      email,
      password, // Assume password is hashed in User model pre-save hook
      role: 'user',
      pointsBalance: 50, // Welcome bonus for new user
      pointsTransactions: [
        {
          amount: 50,
          type: 'earn',
          description: 'Welcome bonus for new user registration',
          createdAt: new Date(),
        },
      ],
    });

    const code = generateRecoveryCode();
    await VerificationCode.create({
      userId: user._id,
      code,
      email,
      type: 'registration',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    await sendNotification({
      userId: user._id,
      type: 'registration',
      title: 'Verify Your Email',
      message: `Your verification code is ${code}. It expires in 15 minutes.`,
      channels: ['email'],
    });

    console.log('New user registered:', { userId: user._id, pointsBalance: user.pointsBalance });

    return NextResponse.json({ success: true, userId: user._id });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ success: false, error: 'Registration failed' }, { status: 500 });
  } 
}