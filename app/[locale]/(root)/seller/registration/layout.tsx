import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getSellerByUserId } from '@/lib/actions/seller.actions';
import { getSetting } from '@/lib/actions/setting.actions';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';

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

    if (!session?.user) {
      return redirect(`/${locale}/sign-in?callbackUrl=/${locale}/seller/registration`);
    }

    // تحقق من حالة البائع
    let seller = null;
    try {
      const sellerResponse = await getSellerByUserId(session.user.id!);
      if (sellerResponse.success && sellerResponse.data) {
        seller = sellerResponse.data;
      }
    } catch (error) {
      // لو البائع مش موجود، خلي الصفحة تستمر بدون إعادة توجيه
      console.error('Error checking seller:', error);
    }

    // لو البائع موجود وتم التحقق منه، وجهه للـ dashboard
    if (seller && seller.verification.status === 'verified') {
      return redirect(`/${locale}/seller/dashboard`);
    }

    // اعرض صفحة التسجيل لو ما فيش بائع أو البائع لسه في انتظار التحقق
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    );
  } catch (error) {
    console.error('Error in SellerRegistrationLayout:', error);
    if (error instanceof Error && !error.message.includes('NEXT_REDIRECT')) {
      const locale = await getLocale();
      return redirect(`/${locale}/error`);
    }
    throw error;
  }
}