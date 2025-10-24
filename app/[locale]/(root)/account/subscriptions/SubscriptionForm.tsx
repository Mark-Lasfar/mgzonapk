'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils.client';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';
import { SubscriptionPlan } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

interface SubscriptionFormProps {
  seller: any; // هنعدل النوع لاحقًا إذا لزم
  userId: string;
  locale: string;
  plan: SubscriptionPlan;
  paymentMethods: Array<{ id: string; providerName: string }>;
  domainStatus: 'active' | 'expired' | 'pending' | null;
}

export default function SubscriptionForm({ seller, userId, locale, plan, paymentMethods, domainStatus }: SubscriptionFormProps) {
  const t = useTranslations('subscriptions');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleRedeemPoints(formData: FormData) {
    setError(null);
    const planId = formData.get('planId') as string;
    if (!planId) {
      setError(t('errors.planNotFound'));
      return;
    }

    if (!plan.features.pointsRedeemable) {
      setError(t('errors.pointsNotSupported'));
      return;
    }

    if (seller.pointsBalance < plan.pointsCost) {
      setError(t('errors.insufficientPoints'));
      return;
    }

    try {
      const response = await fetch('/app/api/seller/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: planId,
          pointsToRedeem: plan.pointsCost,
          paymentMethod: 'points',
          currency: 'USD',
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: t('success.title'),
          description: t('success.redeemSuccess', { plan: plan.name }),
        });
        router.refresh();
      } else {
        setError(result.message || t('errors.redeemFailed'));
      }
    } catch (err) {
      setError(t('errors.serverError'));
      console.error('Redeem points error:', err);
    }
  }

  async function handlePayment(formData: FormData) {
    setError(null);
    const planId = formData.get('planId') as string;
    const method = formData.get('method') as string;
    const paymentGatewayId = formData.get('paymentGatewayId') as string;

    if (!planId || !method || !paymentGatewayId) {
      setError(t('errors.paymentMethodRequired'));
      return;
    }

    try {
      const response = await fetch('/api/payment/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          planId,
          amount: plan.price,
          currency: 'USD',
          method,
          domainRenewal: plan.features.domainRenewal,
          paymentGatewayId,
        }),
      });

      const data = await response.json();

      if (data.success && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        setError(data.message || t('errors.paymentFailed'));
      }
    } catch (err) {
      setError(t('errors.paymentFailed'));
      console.error('Payment error:', err);
    }
  }

  const SubmitButton = ({ children, ...props }: React.ComponentProps<typeof Button>) => {
    const { pending } = useFormStatus();
    return (
      <Button {...props} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : children}
      </Button>
    );
  };

  return (
    <Card dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold">{plan.name}</h2>
        <p className="text-muted-foreground">
          {formatCurrency(plan.price)}/{t('month')} {t('or')} {plan.pointsCost} {t('points')}
          {plan.isTrial && plan.trialDuration && ` (${t('trialMonths', { count: plan.trialDuration })})`}
        </p>
        {plan.features.domainSupport && domainStatus && (
          <p className="text-sm mt-1">
            {t('domainStatus')}: <span className={domainStatus === 'expired' ? 'text-error' : 'text-success'}>
              {t(`domainStatus.${domainStatus}`)}
            </span>
          </p>
        )}
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
        {error && <p className="text-error text-red-500 mt-2">{error}</p>}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        {plan.features.pointsRedeemable && (
          <form action={handleRedeemPoints} className="w-full">
            <input type="hidden" name="planId" value={plan.id} />
            <SubmitButton
              variant="outline"
              className="w-full"
              disabled={seller.pointsBalance < plan.pointsCost}
            >
              {t('redeemPoints')}
            </SubmitButton>
          </form>
        )}
        {paymentMethods.map((method) => (
          <form key={method.id} action={handlePayment} className="w-full">
            <input type="hidden" name="planId" value={plan.id} />
            <input type="hidden" name="method" value={method.providerName} />
            <input type="hidden" name="paymentGatewayId" value={method.id} />
            <SubmitButton className="w-full">{t('payWithMethod', { method: method.providerName })}</SubmitButton>
          </form>
        ))}
      </CardFooter>
    </Card>
  );
}