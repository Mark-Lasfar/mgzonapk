import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import VerificationCode from '@/lib/db/models/verification-code.model';
import User from '@/lib/db/models/user.model';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { email, password, code } = await req.json();

    if (!email || !password || !code) {
      return NextResponse.json(
        { error: 'Email, password, and code are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Verify the reset code
    const verification = await VerificationCode.findOne({
      email,
      code,
      type: 'PASSWORD_RESET',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      return NextResponse.json(
        { error: 'Invalid or expired reset code' },
        { status: 400 }
      );
    }

    // Update user password
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    // Mark the code as verified
    await VerificationCode.findByIdAndUpdate(verification._id, { verified: true });

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Error updating password:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    );
  }
}