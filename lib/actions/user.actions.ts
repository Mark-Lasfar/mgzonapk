'use server';

import bcrypt from 'bcryptjs';
import { auth, signIn, signOut } from '@/auth';
import { IUserSignIn, IUserSignUp } from '@/types';
import { UserSignUpSchema, UserUpdateSchema } from '../validator';
import User, { IUser } from '../db/models/user.model';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import VerificationCode from '../db/models/verification-code.model';
import { emailService } from '../services/email/mailer';
import { connectToDatabase } from '../db';
// import { formatError, generateVerificationCode } from '../utils';
import { getTranslations } from 'next-intl/server';
import { getSetting } from './setting.actions';
import { generateVerificationCode } from '../utils/verification';
import { formatError } from '../utils';
import Seller from '../db/models/seller.model';

interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
  redirect?: string;
  requiresVerification?: boolean;
  data?: any;
}

// دالة مساعدة للتحقق من المستخدم وإرسال رمز التحقق
async function checkUserAndSendVerification(email: string, name: string): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  await connectToDatabase();
  const user = await User.findOne({ email });

  if (user && (!user.emailVerified || !user.isActive)) {
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await VerificationCode.findOneAndUpdate(
      { email, type: 'EMAIL_VERIFICATION' },
      { code, expiresAt, verified: false },
      { upsert: true }
    );

    await emailService.sendVerificationCode({ to: email, code, name });

    return {
      success: true,
      message: t('checkEmailForCode'),
      requiresVerification: true,
      redirect: `/verify-code?email=${encodeURIComponent(email)}`,
    };
  }
  return { success: false, error: t('userNotFound') };
}

// CREATE
export async function registerUser(userSignUp: IUserSignUp): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    const user = await UserSignUpSchema.parseAsync({
      name: userSignUp.name,
      email: userSignUp.email,
      password: userSignUp.password,
      phone: userSignUp.phone, // تصحيح من Phone إلى phone
      confirmPassword: userSignUp.confirmPassword,
    });

    await connectToDatabase();

    const existingUser = await User.findOne({ email: user.email });
    if (existingUser) {
      if (!existingUser.emailVerified) {
        return await checkUserAndSendVerification(user.email, user.name);
      }
      throw new Error(t('userAlreadyExists'));
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = await User.create({
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: await bcrypt.hash(user.password, 10),
      role: 'user',
      emailVerified: false,
      isActive: false,
      points: 50,
    });

    await VerificationCode.create({
      email: user.email,
      code,
      type: 'EMAIL_VERIFICATION',
      expiresAt,
      userId: newUser._id,
    });

    await emailService.sendVerificationCode({
      to: user.email,
      code,
      name: user.name,
    });

    return {
      success: true,
      message: t('checkEmailForCode'),
      requiresVerification: true,
      redirect: `/verify-code?email=${encodeURIComponent(user.email)}`,
    };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

// VERIFY EMAIL
export async function verifyEmail(email: string, code: string): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();

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
        error: t('invalidOrExpiredCode'),
      };
    }

    await Promise.all([
      VerificationCode.findByIdAndUpdate(verification._id, { verified: true }),
      User.findOneAndUpdate(
        { email },
        { emailVerified: true, isActive: true }
      ),
    ]);

    return {
      success: true,
      message: t('emailVerified'),
      redirect: '/sign-in', // التوجيه إلى تسجيل الدخول بعد التحقق
    };
  } catch (error) {
    return {
      success: false,
      error: formatError(error),
    };
  }
}

// SEND VERIFICATION EMAIL
export async function sendVerificationEmail(email: string, name: string): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await VerificationCode.findOneAndUpdate(
      { email, type: 'EMAIL_VERIFICATION' },
      { code, expiresAt, verified: false },
      { upsert: true }
    );

    await emailService.sendVerificationCode({
      to: email,
      code,
      name,
    });

    return { success: true, message: t('checkEmailForCode') };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return {
      success: false,
      error: formatError(error),
    };
  }
}

// AUTHENTICATION
export async function signInWithCredentials(credentials: IUserSignIn): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();
    const user = await User.findOne({ email: credentials.email });

    if (!user) {
      throw new Error(t('invalidCredentials'));
    }

    if (!user.emailVerified || !user.isActive) {
      return await checkUserAndSendVerification(user.email, user.name);
    }

    const result = await signIn('credentials', {
      redirect: false,
      email: credentials.email,
      password: credentials.password,
    });

    if (!result?.ok) {
      throw new Error(t('invalidCredentials'));
    }

    return { success: true, redirect: '/' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : t('authenticationFailed'),
      redirect: '/sign-in',
    };
  }
}

export async function SignInWithGoogle(): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();

    const result = await signIn('google', {
      redirect: false,
      callbackUrl: '/verify-code',
    });

    if (!result?.ok || result?.error) {
      throw new Error(result?.error || t('googleSignInFailed'));
    }

    const session = await auth();
    if (!session?.user?.email) {
      throw new Error(t('noEmailInSession'));
    }

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      const newUser = await User.create({
        email: session.user.email,
        name: session.user.name || session.user.email.split('@')[0],
        role: 'user',
        emailVerified: false,
        isActive: false,
        pointsBalance: 50,
      });

      return await checkUserAndSendVerification(session.user.email, newUser.name);
    }

    if (!user.emailVerified || !user.isActive) {
      return await checkUserAndSendVerification(user.email, user.name);
    }

    // إذا كان المستخدم بائعًا، تحقق من حالة البائع
    if (user.role === 'SELLER' && user.businessProfile) {
      const seller = await Seller.findById(user.businessProfile);
      if (seller) {
        return {
          success: true,
          redirect: seller.verification.status === 'verified' && seller.subscription.status === 'active'
            ? '/seller/dashboard'
            : '/seller/subscriptions',
        };
      }
    }

    return { success: true, redirect: '/' };
  } catch (error) {
    console.error('خطأ في تسجيل الدخول بجوجل:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : t('googleSignInFailed'),
      redirect: '/sign-in',
    };
  }
}

export async function SignOut(): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await signOut({ redirect: false });
    return { success: true, redirect: '/', message: t('signedOut') };
  } catch (error) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : t('signOutFailed'),
      redirect: '/sign-in',
    };
  }
}

// DELETE
export async function deleteUser(id: string): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();
    const res = await User.findByIdAndDelete(id);
    if (!res) throw new Error(t('userNotFound'));
    revalidatePath('/[locale]/admin/users');
    return {
      success: true,
      message: t('userDeleted'),
    };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

// UPDATE
export async function updateUser(user: z.infer<typeof UserUpdateSchema>): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();
    const dbUser = await User.findById(user._id);
    if (!dbUser) throw new Error(t('userNotFound'));
    dbUser.name = user.name;
    dbUser.email = user.email;
    dbUser.role = user.role;
    const updatedUser = await dbUser.save();
    revalidatePath('/[locale]/admin/users');
    return {
      success: true,
      message: t('userUpdated'),
      data: JSON.parse(JSON.stringify(updatedUser)),
    };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

export async function updateUserName(user: { name: string }): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id) throw new Error(t('unauthorized'));
    const currentUser = await User.findById(session.user.id);
    if (!currentUser) throw new Error(t('userNotFound'));
    currentUser.name = user.name;
    const updatedUser = await currentUser.save();
    return {
      success: true,
      message: t('userUpdated'),
      data: JSON.parse(JSON.stringify(updatedUser)),
    };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

export async function updateUserEmail({ userId, email }: { email: string; userId: string }): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();
    const currentUser = await User.findById(userId);
    if (!currentUser) throw new Error(t('userNotFound'));
    const emailExists = await User.findOne({ email });
    if (emailExists && emailExists._id.toString() !== userId) {
      throw new Error(t('emailAlreadyInUse'));
    }
    currentUser.email = email;
    const updatedUser = await currentUser.save();
    return {
      success: true,
      message: t('emailUpdated'),
      data: JSON.parse(JSON.stringify(updatedUser)),
    };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string): Promise<ActionResponse> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) throw new Error(t('userNotFound'));
    if (!user.password) throw new Error(t('noPasswordSet'));
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new Error(t('incorrectCurrentPassword'));
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    return {
      success: true,
      message: t('passwordUpdated'),
    };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
}

// GET
export async function getAllUsers({ limit, page }: { limit?: number; page: number }): Promise<{ data: IUser[]; totalPages: number }> {
  const t = await getTranslations('Auth');
  try {
    const { common: { pageSize } } = await getSetting();
    limit = limit || pageSize;
    await connectToDatabase();
    const skipAmount = (Number(page) - 1) * limit;
    const [users, usersCount] = await Promise.all([
      User.find().sort({ createdAt: 'desc' }).skip(skipAmount).limit(limit).lean(),
      User.countDocuments(),
    ]);
    return {
      data: users as IUser[],
      totalPages: Math.ceil(usersCount / limit),
    };
  } catch (error) {
    throw new Error(t('errorFetchingUsers'));
  }
}

export async function getUserById(userId: string): Promise<IUser> {
  const t = await getTranslations('Auth');
  try {
    await connectToDatabase();
    const user = await User.findById(userId);
    if (!user) throw new Error(t('userNotFound'));
    return JSON.parse(JSON.stringify(user)) as IUser;
  } catch (error) {
    throw new Error(t('errorFetchingUser'));
  }
}