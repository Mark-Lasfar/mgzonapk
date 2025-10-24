// /home/mark/Music/my-nextjs-project-clean/components/account/subscriptions/SubscriptionsList.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useQuery } from '@apollo/client';
import { GET_SUBSCRIPTION_PLANS, GET_SELLER_SUBSCRIPTION } from '@/graphql/subscription/queries';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  pointsCost: number;
  description: string;
  features: {
    productsLimit: number;
    commission: number;
    prioritySupport: boolean;
    instantPayouts: boolean;
    customSectionsLimit: number;
    domainSupport: boolean;
    domainRenewal: boolean;
    pointsRedeemable: boolean;
    dynamicPaymentGateways: boolean;
    maxApiKeys: number;
    analyticsAccess: boolean;
    abTesting: boolean;
  };
  isTrial: boolean;
  trialDuration?: number;
  isActive: boolean;
}

interface SellerSubscription {
  status: 'active' | 'inactive' | 'expired';
  planId: string;
  endDate: string;
  pointsBalance: number;
}

export default function SubscriptionsList({ locale }: { locale: string }) {
  const t = useTranslations('subscriptions');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const { data: plansData, loading: plansLoading, error: plansError } = useQuery(GET_SUBSCRIPTION_PLANS);
  const { data: sellerData, loading: sellerLoading, error: sellerError } = useQuery(GET_SELLER_SUBSCRIPTION);

  useEffect(() => {
    if (plansError || sellerError) {
      toast({
        title: t('errors.fetchFailed'),
        description: plansError?.message || sellerError?.message || t('errors.serverError'),
        variant: 'destructive',
      });
    }
  }, [plansError, sellerError, t]);

  const handleSelectPlan = (planId: string, isPointsRedeemable: boolean) => {
    setIsLoading(true);
    if (isPointsRedeemable) {
      router.push(`/${locale}/account/subscriptions/redeem-points?planId=${planId}`);
    } else {
      router.push(`/${locale}/account/subscriptions/checkout?planId=${planId}`);
    }
    setIsLoading(false);
  };

  if (plansLoading || sellerLoading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const plans: SubscriptionPlan[] = plansData?.subscriptionPlans || [];
  const sellerSubscription: SellerSubscription = sellerData?.sellerSubscription;
  const isSubscriptionExpired = sellerSubscription?.status === 'expired' || (sellerSubscription?.endDate && new Date(sellerSubscription.endDate) < new Date());

  return (
    <div className="container mx-auto p-6" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id}>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="text-muted-foreground">
                ${plan.price}/{t('month')} {plan.pointsCost > 0 && `or ${plan.pointsCost} ${t('points')}`}
                {plan.isTrial && plan.trialDuration && ` (${t('trialMonths', { count: plan.trialDuration })})`}
              </p>
              <p className="mt-2">{plan.description}</p>
              <ul className="mt-4 space-y-1">
                <li>{t('features.productsLimit', { count: plan.features.productsLimit })}</li>
                <li>{t('features.commission', { count: plan.features.commission })}</li>
                <li>{t('features.prioritySupport', { enabled: plan.features.prioritySupport ? t('yes') : t('no') })}</li>
                <li>{t('features.instantPayouts', { enabled: plan.features.instantPayouts ? t('yes') : t('no') })}</li>
                <li>{t('features.customSections', { count: plan.features.customSectionsLimit })}</li>
                <li>{t('features.domainSupport', { enabled: plan.features.domainSupport ? t('yes') : t('no') })}</li>
                <li>{t('features.domainRenewal', { enabled: plan.features.domainRenewal ? t('yes') : t('no') })}</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => handleSelectPlan(plan.id, plan.features.pointsRedeemable)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="animate-spin" /> : t('selectPlan')}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}