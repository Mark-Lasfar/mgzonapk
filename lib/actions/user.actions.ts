'use server';

import bcrypt from 'bcryptjs';
import { auth, signIn, signOut } from '@/auth';
import { IUserName, IUserSignIn, IUserSignUp } from '@/types';
import { UserSignUpSchema, UserUpdateSchema } from '../validator';
import { connectToDatabase } from '../db';
import User, { IUser } from '../db/models/user.model';
import { formatError, generateVerificationCode } from '../utils';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSetting } from './setting.actions';
import VerificationCode from '../db/models/verification-code.model';
import { emailService } from '../services/email/mailer';

// CREATE
export async function registerUser(userSignUp: IUserSignUp) {
  try {
    const user = await UserSignUpSchema.parseAsync({
      name: userSignUp.name,
      email: userSignUp.email,
      password: userSignUp.password,
      confirmPassword: userSignUp.confirmPassword,
    });

    await connectToDatabase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: user.email });
    if (existingUser) {
      if (!existingUser.emailVerified) {
        await sendVerificationEmail(user.email, user.name);
        return {
          success: true,
          message: 'Please check your email for new verification code',
          requiresVerification: true,
        };
      }
      throw new Error('User already exists');
    }

    // Generate verification code and create user
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create unverified user
    const newUser = await User.create({
      ...user,
      password: await bcrypt.hash(user.password, 10),
      role: 'user',
      emailVerified: false,
      isActive: false,
      points: 50, // Assign 50 welcome points
    });

    // Create verification code
    await VerificationCode.create({
      email: user.email,
      code,
      type: 'EMAIL_VERIFICATION',
      expiresAt,
      userId: newUser._id,
    });

    // Send verification email
    await emailService.sendVerificationCode({
      to: user.email,
      code,
      name: user.name,
    });

    return {
      success: true,
      message: 'Please check your email for verification code',
      requiresVerification: true,
    };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

export async function verifyEmail(email: string, code: string) {
  try {
    await connectToDatabase();

    // Find verification code
    const verification = await VerificationCode.findOne({
      email,
      code,
      type: 'EMAIL_VERIFICATION',
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      return {
        success: false,
        error: 'Invalid or expired verification code',
      };
    }

    // Update both verification and user status
    await Promise.all([
      VerificationCode.findByIdAndUpdate(verification._id, { verified: true }),
      User.findOneAndUpdate(
        { email },
        {
          emailVerified: true,
          isActive: true,
        }
      ),
    ]);

    return {
      success: true,
      message: 'Email verified successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }
}

export async function sendVerificationEmail(email: string, name: string) {
  try {
    await connectToDatabase();

    // Generate verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create or update verification code
    await VerificationCode.findOneAndUpdate(
      { email, type: 'EMAIL_VERIFICATION' },
      {
        code,
        expiresAt,
        verified: false,
      },
      { upsert: true }
    );

    // Send email
    await emailService.sendVerificationCode({
      to: email,
      code,
      name,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return {
      success: false,
      error: formatError(error),
    };
  }
}

// Authentication functions
export async function signInWithCredentials(credentials: IUserSignIn) {
  try {
    await connectToDatabase();
    const user = await User.findOne({ email: credentials.email });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.emailVerified || !user.isActive) {
      await sendVerificationEmail(user.email, user.name);
      return {
        success: false,
        error: 'Please verify your email before signing in',
        requiresVerification: true,
      };
    }

    const result = await signIn('credentials', {
      redirect: false,
      email: credentials.email,
      password: credentials.password,
    });

    if (!result?.ok) {
      throw new Error('Invalid email or password');

    }

    return { success: true, redirect: '/' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}

export async function SignInWithGoogle() {
  try {
    await connectToDatabase();

    // Perform Google sign-in
    const result = await signIn('google', {
      redirect: false,
      callbackUrl: '/',
    });

    if (!result?.ok || result?.error) {
      throw new Error(result?.error || 'Google authentication failed');
    }

    // Check if user exists and needs verification
    const session = await auth();
    if (!session?.user?.email) {
      throw new Error('No user email found in session');
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      // Create new user if they don't exist
      const newUser = await User.create({
        email: session.user.email,
        name: session.user.name || session.user.email.split('@')[0],
        role: 'user',
        emailVerified: false,
        isActive: false,
        points: 50,
      });

      // Generate and send verification code
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await VerificationCode.create({
        email: session.user.email,
        code,
        type: 'EMAIL_VERIFICATION',
        expiresAt,
        userId: newUser._id,
      });

      await emailService.sendVerificationCode({
        to: session.user.email,
        code,
        name: session.user.name || session.user.email.split('@')[0],
      });

      return {
        success: true,
        message: 'Please check your email for verification code',
        requiresVerification: true,
        redirect: `/verify-code?email=${encodeURIComponent(session.user.email)}`,
      };
    }

    if (!user.emailVerified || !user.isActive) {
      // Send verification code if email is not verified
      await sendVerificationEmail(user.email, user.name);
      return {
        success: true,
        message: 'Please check your email for verification code',
        requiresVerification: true,
        redirect: `/verify-code?email=${encodeURIComponent(user.email)}`,
      };
    }

    return { success: true, redirect: '/' };
  } catch (error) {
    console.error('Google sign-in error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Google authentication failed',
    };
  }
}

export async function SignOut() {
  try {
    await signOut({ redirect: false });
    return { success: true, redirect: '/' };
  } catch (error) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign out',
    };
  }
}

// DELETE
export async function deleteUser(id: string) {
  try {
    await connectToDatabase();
    const res = await User.findByIdAndDelete(id);
    if (!res) throw new Error('User not found');
    revalidatePath('/[locale]/admin/users');
    return {
      success: true,
      message: 'User deleted successfully',
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// UPDATE
export async function updateUser(user: z.infer<typeof UserUpdateSchema>) {
  try {
    await connectToDatabase();
    const dbUser = await User.findById(user._id);
    if (!dbUser) throw new Error('User not found');
    dbUser.name = user.name;
    dbUser.email = user.email;
    dbUser.role = user.role;
    const updatedUser = await dbUser.save();
    revalidatePath('/[locale]/admin/users');
    return {
      success: true,
      message: 'User updated successfully',
      data: JSON.parse(JSON.stringify(updatedUser)),
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

export async function updateUserName(user: IUserName) {
  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id) throw new Error('Unauthorized');

    const currentUser = await User.findById(session.user.id);
    if (!currentUser) throw new Error('User not found');

    currentUser.name = user.name;
    const updatedUser = await currentUser.save();

    return {
      success: true,
      message: 'User updated successfully',
      data: JSON.parse(JSON.stringify(updatedUser)),
    };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

// GET functions
export async function getAllUsers({
  limit,
  page,
}: {
  limit?: number;
  page: number;
}) {
  try {
    const {
      common: { pageSize },
    } = await getSetting();

    limit = limit || pageSize;
    await connectToDatabase();

    const skipAmount = (Number(page) - 1) * limit;

    const [users, usersCount] = await Promise.all([
      User.find()
        .sort({ createdAt: 'desc' })
        .skip(skipAmount)
        .limit(limit),
      User.countDocuments(),
    ]);

    return {
      data: JSON.parse(JSON.stringify(users)) as IUser[],
      totalPages: Math.ceil(usersCount / limit),
    };
  } catch (error) {
    console.error('Error getting users:', error);
    throw error;
  }
}

export async function getUserById(userId: string) {
  try {
    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');
    return JSON.parse(JSON.stringify(user)) as IUser;
  } catch (error) {
    console.error('Error getting user by id:', error);
    throw error;
  }
}