'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { updateSellerSubscription } from '@/lib/actions/seller.actions';
import { createPaymentSession } from '@/lib/utils/payments';
// import { toast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

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
  };
  isTrial?: boolean;
  trialDuration?: number;
}

interface SubscriptionFormProps {
  plan: SubscriptionPlan;
  seller: any;
  userId: string;
  locale: string;
}

export default function SubscriptionForm({ plan, seller, userId, locale }: SubscriptionFormProps) {
  const t = useTranslations('Subscriptions');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleRedeemPoints = async (formData: FormData) => {
    const planId = formData.get('planId') as string;
    if (!planId) {
      setError(t('errors.planNotFound'));
      return;
    }

    if (seller.pointsBalance < plan.pointsCost) {
      setError(t('errors.insufficientPoints'));
      return;
    }

    const result = await updateSellerSubscription(userId, plan.name as 'Trial' | 'Basic' | 'Pro' | 'VIP', plan.pointsCost);
    if (result.success) {
      toast({
        title: t('success'),
        description: t('redeemSuccess', { plan: plan.name }),
      });
      router.refresh();
    } else {
      setError(result.error || t('errors.redeemFailed'));
    }
  };

  const handlePayment = async (formData: FormData) => {
    const planId = formData.get('planId') as string;
    const method = formData.get('method') as 'stripe' | 'paypal';
    if (!planId) {
      setError(t('errors.planNotFound'));
      return;
    }

    const sessionUrl = await createPaymentSession({
      userId,
      planId,
      amount: plan.price,
      currency: 'USD',
      method,
    });

    if (sessionUrl) {
      window.location.href = sessionUrl;
    } else {
      setError(t('errors.paymentFailed'));
    }
  };

  const SubmitButton = ({ children, ...props }: React.ComponentProps<typeof Button>) => {
    const { pending } = useFormStatus();
    return (
      <Button {...props} disabled={pending}>
        {pending ? t('loading') : children}
      </Button>
    );
  };

  return (
    <Card dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <CardContent className="p-6">
        <h2 className="text-xl font-semibold">{plan.name}</h2>
        <p className="text-muted-foreground">
          {formatCurrency(plan.price)}/{t('month')} {t('or')} {plan.pointsCost} {t('points')}
          {plan.isTrial && ` (${t('trialMonths', { count: plan.trialDuration })})`}
        </p>
        <p>{plan.description}</p>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <form action={handleRedeemPoints} className="w-full">
          <input type="hidden" name="planId" value={plan.id} />
          <SubmitButton variant="outline" className="w-full">
            {t('redeemPoints')}
          </SubmitButton>
        </form>
        <form action={handlePayment} className="w-full">
          <input type="hidden" name="planId" value={plan.id} />
          <input type="hidden" name="method" value="stripe" />
          <SubmitButton className="w-full">{t('payWithStripe')}</SubmitButton>
        </form>
        <form action={handlePayment} className="w-full">
          <input type="hidden" name="planId" value={plan.id} />
          <input type="hidden" name="method" value="paypal" />
          <SubmitButton className="w-full">{t('payWithPayPal')}</SubmitButton>
        </form>
      </CardFooter>
    </Card>
  );
}