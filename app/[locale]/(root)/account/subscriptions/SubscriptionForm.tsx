'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { updateSellerSubscription } from '@/lib/actions/seller.actions';
import { createPaymentSession } from '@/lib/utils/payments';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { connectToDatabase } from '@/lib/db';
import { getSubscriptionPlans } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

type SubscriptionPlan = ReturnType<typeof getSubscriptionPlans>[number];

interface SubscriptionFormProps {
  seller: any;
  userId: string;
  locale: string;
}

async function getActivePaymentIntegrations(userId: string) {
  await connectToDatabase();
  const integrations = await (await import('@/lib/db/models/integration.model')).default.find({
    enabledBySellers: userId,
    type: 'payment',
    category: 'payment',
    isActive: true,
    status: 'connected',
  });
  return integrations.map((int: any) => ({
    id: int._id.toString(),
    providerName: int.providerName,
  }));
}

export default function SubscriptionForm({ seller, userId, locale }: SubscriptionFormProps) {
  const t = useTranslations('subscriptions');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [domainStatus, setDomainStatus] = useState<'active' | 'expired' | 'pending' | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<Array<{ id: string; providerName: string }>>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        const [fetchedPlans, integrations] = await Promise.all([
          Promise.resolve(getSubscriptionPlans()),
          getActivePaymentIntegrations(userId),
        ]);

        setPlans(fetchedPlans);
        setSelectedPlan(fetchedPlans[0] || null);
        setPaymentMethods(integrations);

        if (fetchedPlans[0]?.features.domainSupport && seller.customSiteUrl) {
          const res = await fetch(`/api/domains/${seller.customSiteUrl}/status`, {
            headers: { Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN}` },
          });
          if (!res.ok) throw new Error('Failed to fetch domain status');
          const data = await res.json();
          setDomainStatus(data.status || 'pending');
        }
      } catch (err) {
        setError(t('errors.fetchFailed'));
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [seller.customSiteUrl, t, userId]);

  const handleRedeemPoints = async (formData: FormData) => {
    if (!selectedPlan) return;
    setError(null);
    const planId = formData.get('planId') as string;
    if (!planId) {
      setError(t('errors.planNotFound'));
      return;
    }

    if (!selectedPlan.features.pointsRedeemable) {
      setError(t('errors.pointsNotSupported'));
      return;
    }

    if (seller.pointsBalance < selectedPlan.pointsCost) {
      setError(t('errors.insufficientPoints'));
      return;
    }

    try {
      const result = await updateSellerSubscription(
        userId,
        {
          plan: planId,
          pointsToRedeem: selectedPlan.pointsCost,
          paymentMethod: 'points',
        },
        locale
      );
      if (result.success) {
        toast({
          title: t('success.title'),
          description: t('success.redeemSuccess', { plan: selectedPlan.name }),
        });
        router.refresh();
      } else {
        setError(result.error || t('errors.redeemFailed'));
      }
    } catch (err) {
      setError(t('errors.serverError'));
      console.error('Redeem points error:', err);
    }
  };

  const handlePayment = async (formData: FormData) => {
    if (!selectedPlan) return;
    setError(null);
    const planId = formData.get('planId') as string;
    const method = formData.get('method') as string;
    const paymentGatewayId = formData.get('paymentGatewayId') as string;
    if (!planId || !method || !paymentGatewayId) {
      setError(t('errors.paymentMethodRequired'));
      return;
    }

    try {
      const sessionUrl = await createPaymentSession({
        userId,
        planId,
        amount: selectedPlan.price,
        currency: 'USD',
        method,
        domainRenewal: selectedPlan.features.domainRenewal,
        paymentGatewayId,
      });

      if (sessionUrl) {
        window.location.href = sessionUrl;
      } else {
        setError(t('errors.paymentFailed'));
      }
    } catch (err) {
      setError(t('errors.paymentFailed'));
      console.error('Payment error:', err);
    }
  };

  const SubmitButton = ({ children, ...props }: React.ComponentProps<typeof Button>) => {
    const { pending } = useFormStatus();
    return (
      <Button {...props} disabled={pending || !selectedPlan}>
        {pending ? <Loader2 className="animate-spin" /> : children}
      </Button>
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>;
  }

  if (!selectedPlan) {
    return <div className="text-center p-6">{t('errors.noPlansAvailable')}</div>;
  }

  return (
    <Card dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold">{selectedPlan.name}</h2>
        <p className="text-muted-foreground">
          {formatCurrency(selectedPlan.price)}/{t('month')} {t('or')} {selectedPlan.pointsCost} {t('points')}
          {selectedPlan.isTrial && selectedPlan.trialDuration && ` (${t('trialMonths', { count: selectedPlan.trialDuration })})`}
        </p>
        {selectedPlan.features.domainSupport && domainStatus && (
          <p className="text-sm mt-1">
            {t('domainStatus')}: <span className={domainStatus === 'expired' ? 'text-error' : 'text-success'}>
              {t(`domainStatus.${domainStatus}`)}
            </span>
          </p>
        )}
        <p className="mt-2">{selectedPlan.description}</p>
        <ul className="mt-4 space-y-1">
          <li>{t('features.productsLimit', { count: selectedPlan.features.productsLimit })}</li>
          <li>{t('features.commission', { count: selectedPlan.features.commission })}</li>
          <li>{t('features.prioritySupport', { enabled: selectedPlan.features.prioritySupport ? t('yes') : t('no') })}</li>
          <li>{t('features.instantPayouts', { enabled: selectedPlan.features.instantPayouts ? t('yes') : t('no') })}</li>
          <li>{t('features.customSections', { count: selectedPlan.features.customSectionsLimit })}</li>
          <li>{t('features.domainSupport', { enabled: selectedPlan.features.domainSupport ? t('yes') : t('no') })}</li>
          <li>{t('features.domainRenewal', { enabled: selectedPlan.features.domainRenewal ? t('yes') : t('no') })}</li>
        </ul>
        {error && <p className="text-error text-red-500 mt-2">{error}</p>}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        {selectedPlan.features.pointsRedeemable && (
          <form action={handleRedeemPoints} className="w-full">
            <input type="hidden" name="planId" value={selectedPlan.id} />
            <SubmitButton
              variant="outline"
              className="w-full"
              disabled={seller.pointsBalance < selectedPlan.pointsCost}
            >
              {t('redeemPoints')}
            </SubmitButton>
          </form>
        )}
        {paymentMethods.map((method) => (
          <form key={method.id} action={handlePayment} className="w-full">
            <input type="hidden" name="planId" value={selectedPlan.id} />
            <input type="hidden" name="method" value={method.providerName} />
            <input type="hidden" name="paymentGatewayId" value={method.id} />
            <SubmitButton className="w-full">{t('payWithMethod', { method: method.providerName })}</SubmitButton>
          </form>
        ))}
      </CardFooter>
    </Card>
  );
}