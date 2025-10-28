import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getSellerByUserId } from '@/lib/actions/seller.actions';
import { getSetting } from '@/lib/actions/setting.actions';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import User from '@/lib/db/models/user.model';

export const metadata: Metadata = {
  title: 'Seller Registration',
  description: 'Register as a seller on our platform',
};

export default async function SellerRegistrationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  try {
    const [locale, session, settings] = await Promise.all([
      getLocale(),
      auth(),
      getSetting(),
    ]);

    // التحقق من وجود جلسة المستخدم
    if (!session?.user?.id) {
      return redirect(`/${locale}/sign-in?callbackUrl=/${locale}/seller/registration`);
    }

    // التحقق من حالة التحقق من البريد
    const user = await User.findById(session.user.id);
    if (!user) {
      return redirect(`/${locale}/sign-in?callbackUrl=/${locale}/seller/registration`);
    }
    if (!user.emailVerified) {
      return redirect(`/${locale}/verify-code?email=${encodeURIComponent(user.email)}`);
    }

    // التحقق من دور المستخدم
    if (session.user.role === 'SELLER') {
      const sellerResponse = await getSellerByUserId(session.user.id);
      if (sellerResponse.success && sellerResponse.data) {
        const seller = sellerResponse.data;
        if (seller.verification.status === 'verified') {
          if (seller.subscription.status === 'active') {
            return redirect(`/${locale}/seller/dashboard`);
          } else {
            return redirect(`/${locale}/seller/subscriptions`);
          }
        }
      }
    }

    // عرض صفحة التسجيل
    return <div className="min-h-screen bg-background">{children}</div>;
  } catch (error) {
    console.error('Error in SellerRegistrationLayout:', error);
    const locale = await getLocale();
    return <div className="min-h-screen bg-background">{children}</div>;
  }
}