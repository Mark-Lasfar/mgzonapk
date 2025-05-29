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

  if (!session?.user) {
    redirect(`/${locale}/sign-in`);
  }

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

  // Server Action to handle form submission
  async function handleSubmit(formData: any) {
    'use server';
    const result = await updateSellerSettings(session.user.id, {
      businessName: formData.businessName,
      email: formData.email,
      phone: formData.phone,
      description: formData.description,
      address: formData.address,
    });
    return result;
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