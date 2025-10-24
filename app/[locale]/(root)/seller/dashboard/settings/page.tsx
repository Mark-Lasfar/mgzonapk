// app/[locale]/(root)/seller/dashboard/settings/page.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import SellerSettingsForm from './settings-form';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';

export default function SettingsPage({ locale }: { locale: string }) {
  const t = useTranslations('SellerSettings');
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeller = async () => {
      // التحقق من المصادقة والصلاحيات
      if (status === 'loading') return;
      
      if (status !== 'authenticated' || !session?.user) {
        router.push(`/${locale}/sign-in`);
        return;
      }

      if (session.user.role !== 'SELLER') {
        router.push(`/${locale}/seller/dashboard`);
        return;
      }

      // التحقق من وجود customSiteUrl و accessToken
      if (!session.user.customSiteUrl || !session.accessToken) {
        toast({ 
          description: t('errors.missingData') || 'Missing required data', 
          variant: 'destructive' 
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(
          `/api/seller/${session.user.customSiteUrl}?locale=${locale}`, 
          {
            headers: { 
              Authorization: `Bearer ${session.accessToken}` 
            },
          }
        );
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || t('errors.fetchFailed'));
        }
        
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || t('errors.fetchFailed'));
        }
        
        setSeller(data.data);
      } catch (err: any) {
        const errorMessage = err.message || t('errors.fetchFailed');
        toast({ 
          description: errorMessage, 
          variant: 'destructive' 
        });
        console.error('Failed to fetch seller:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSeller();
  }, [t, status, session, locale, router]);

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto p-6 flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Unauthenticated
  if (status === 'unauthenticated' || !session?.user) {
    router.push(`/${locale}/sign-in`);
    return null;
  }

  // Unauthorized
  if (session.user.role !== 'SELLER') {
    router.push(`/${locale}/seller/dashboard`);
    return null;
  }

  return (
    <div className="container mx-auto p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <SellerSettingsForm seller={seller} locale={locale} />
    </div>
  );
}