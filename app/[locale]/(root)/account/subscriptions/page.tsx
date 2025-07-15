'use server';

import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Seller from '@/lib/db/models/seller.model';
import { connectToDatabase } from '@/lib/db';
// import { subscriptionPlans } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import SubscriptionForm from './SubscriptionForm';
import { subscriptionPlans } from '@/lib/utils/subscription-plans';

interface SubscriptionsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SubscriptionsPage({ params }: SubscriptionsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'subscriptions' });
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/sign-in`);
  }

  try {
    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id });

    if (!seller) {
      return (
        <div className="container mx-auto p-6">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>{t('errors.sellerNotFound')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('errors.registerPrompt')}</p>
              <Button asChild className="mt-4">
                <a href={`/${locale}/seller/registration`}>{t('account.startSelling')}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (!seller.bankInfo?.verified) {
      return (
        <div className="container mx-auto p-6">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>{t('errors.bankInfoNotVerified')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('errors.verifyBankPrompt')}</p>
              <Button asChild className="mt-4">
                <a href={`/${locale}/seller/dashboard/settings`}>{t('account.verifyBank')}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    let domainStatus: 'active' | 'expired' | 'pending' = 'pending';
    if (seller.customSiteUrl) {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/domains/${seller.customSiteUrl}/status`, {
          headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN}` },
        });
        const data = await res.json();
        domainStatus = data.status || 'pending';
      } catch {
        domainStatus = 'pending';
      }
    }

    const isSubscriptionExpired =
      seller.subscription.status !== 'active' ||
      (seller.subscription.endDate && new Date(seller.subscription.endDate) < new Date());

    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
        {isSubscriptionExpired && (
          <Card className="mb-6 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-600">{t('errors.subscriptionExpired')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('errors.renewPrompt')}</p>
            </CardContent>
          </Card>
        )}
        {domainStatus === 'expired' && (
          <Card className="mb-6 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-600">{t('errors.domainExpired')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{t('errors.renewDomainPrompt')}</p>
            </CardContent>
          </Card>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subscriptionPlans.map((plan) => (
            <SubscriptionForm
              key={plan.id}
              plan={plan}
              seller={seller.toJSON()}
              userId={session.user.id ?? ''}
              locale={locale}
            />
          ))}
        </div>
      </div>
    );
  } catch (error) {
    console.error('SubscriptionsPage error:', error);
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>{t('errors.serverError')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{t('errors.tryAgain')}</p>
            <Button asChild className="mt-4">
              <a href={`/${locale}/account/subscriptions`}>{t('retry')}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}