// app/[locale]/(root)/seller/dashboard/settings/account/page.tsx
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSellerByUserId, updateSellerSettings } from '@/lib/actions/seller.actions';
import { User } from 'lucide-react';
import SellerAccountForm from './SellerAccountForm';

export default async function SellerAccountSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations('SellerDashboard');
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/sign-in`);
  }

  try {
    const sellerResult = await getSellerByUserId(session.user.id, locale);
    if (!sellerResult.success || !sellerResult.data) {
      return (
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">{t('accountSettings')}</h1>
          <p className="text-red-600">{t('errors.sellerNotFound')}</p>
        </div>
      );
    }

    const seller = sellerResult.data;

    if (seller.subscription?.status !== 'active') {
      redirect(`/${locale}/seller/dashboard/settings`);
    }

    async function handleSubmit(formData: any) {
      'use server';
      try {
        if (!session?.user?.id) {
          return { success: false, error: 'User not authenticated' };
        }
        const result = await updateSellerSettings(session.user.id, {
          businessName: formData.businessName,
          email: formData.email,
          phone: formData.phone,
          description: formData.description,
          address: formData.address,
          notifications: formData.notifications || {
            email: false,
            sms: false,
            orderUpdates: false,
            marketingEmails: false,
            pointsNotifications: false,
          },
          display: formData.display || {
            showRating: false,
            showContactInfo: false,
            showMetrics: false,
            showPointsBalance: false,
          },
          security: formData.security || {
            twoFactorAuth: false,
            loginNotifications: false,
          },
          customSite: formData.customSite || {
            theme: '',
            primaryColor: '',
          },
        });
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return { success: false, error: errorMessage };
      }
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t('accountSettings')}</h1>
        <p className="text-red-600">Error: {errorMessage}</p>
      </div>
    );
  }
}