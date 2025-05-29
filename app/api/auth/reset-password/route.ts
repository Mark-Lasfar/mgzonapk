import { NextResponse } from 'next/server';
import { emailService } from '@/lib/services/email/mailer';
import { generateRecoveryCode } from '@/lib/utils/verification';
import { connectToDatabase } from '@/lib/db';
import VerificationCode from '@/lib/db/models/verification-code.model';
import User from '@/lib/db/models/user.model';
import { rateLimit } from '@/lib/utils/rate-limit';

export async function POST(req: Request) {
  try {
    // Apply rate limiting (e.g., 1 request per 5 minutes per email)
    const { success, reset } = await rateLimit(req, {
      max: 1,
      windowMs: 5 * 60 * 1000, // 5 minutes
      key: 'reset-password',
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const { identifier } = await req.json();

    if (!identifier || typeof identifier !== 'string') {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check if user exists
    const user = await User.findOne({ email: identifier });
    if (!user) {
      // Return generic error to prevent email enumeration
      return NextResponse.json(
        { success: true, message: 'If the email exists, a recovery code has been sent.' },
        { status: 200 }
      );
    }

    // Delete any existing recovery codes for this email
    await VerificationCode.deleteMany({
      email: identifier,
      type: 'PASSWORD_RESET',
      verified: false,
    });

    // Generate and store new recovery code
    const recoveryCode = generateRecoveryCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await VerificationCode.create({
      email: identifier,
      code: recoveryCode,
      type: 'PASSWORD_RESET',
      expiresAt,
      verified: false,
      userId: user._id,
    });

    // Send professional email with HTML template
    await emailService.send({
      to: identifier,
      subject: 'MGZon - Reset Your Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Dear ${user.name || 'User'},</p>
          <p>We received a request to reset your password for your MGZon account. Use the following code to reset your password:</p>
          <p style="font-size: 24px; font-weight: bold; color: #2563eb; text-align: center; margin: 20px 0;">
            ${recoveryCode}
          </p>
          <p>This code will expire in 15 minutes. If you did not request a password reset, please ignore this email or contact our support team.</p>
          <p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/help" style="color: #2563eb; text-decoration: none;">
              Contact Support
            </a>
          </p>
          <p>Best regards,<br />The MGZon Team</p>
        </div>
      `,
      text: `Your MGZon password reset code is: ${recoveryCode}. This code will expire in 15 minutes. If you did not request this, please ignore or contact support at ${process.env.NEXT_PUBLIC_APP_URL}/help.`,
    });

    return NextResponse.json({
      success: true,
      message: 'If the email exists, a recovery code has been sent.',
    });
  } catch (error) {
    console.error('Error in reset-password route:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}