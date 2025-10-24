// app/[locale]/(root)/seller/dashboard/settings/account/page.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from 'lucide-react';
import SellerAccountForm from './SellerAccountForm';
import { useEffect, useState } from 'react';

interface SellerData {
  businessName: string;
  email: string;
  phone: string;
  description?: string;
  address: {
    street: string;
    city: string;
    state?: string;
    postalCode: string;
    countryCode: string;
  };
  subscription?: {
    status: string;
  };
}

export default function SellerAccountSettingsPage({
  locale,
}: {
  locale: string;
}) {
  const t = useTranslations('SellerDashboard');
  const { data: session, status } = useSession();
  const router = useRouter();
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session?.user?.id) {
      router.push(`/${locale}/sign-in`);
      return;
    }

    fetchSellerData();
  }, [status, session, locale, router]);

  const fetchSellerData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/settings`,
        {
          headers: {
            Authorization: `Bearer ${session?.user?.token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        setError(t('errors.sellerNotFound'));
        return;
      }

      const sellerData = result.data;
      
      if (sellerData.subscription?.status !== 'active') {
        router.push(`/${locale}/seller/dashboard/settings`);
        return;
      }

      setSeller(sellerData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    if (!session?.user?.token) {
      return { success: false, error: 'No authentication token' };
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/settings`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.user.token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const result = await response.json();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return { success: false, error: errorMessage };
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t('accountSettings')}</h1>
        <p className="text-red-600">{error || t('errors.sellerNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t('accountSettings')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SellerAccountForm seller={seller} onSubmit={handleSubmit} />
        </CardContent>
      </Card>
    </div>
  );
}