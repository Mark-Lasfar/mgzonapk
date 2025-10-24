// /home/mark/Music/my-nextjs-project-clean/app/[locale]/(root)/account/subscriptions/redeem-points/RedeemPointsClient.tsx
'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useMutation } from '@apollo/client/react';
import { REDEEM_SUBSCRIPTION_POINTS } from '@/graphql/subscription/mutations';

interface RedeemPointsClientProps {
  plan: {
    id: string;
    name: string;
    pointsCost: number;
  };
  seller: {
    pointsBalance: number;
  };
  userId: string;
  locale: string;
}

export default function RedeemPointsClient({ seller, plan, userId, locale }: RedeemPointsClientProps) {
  const t = useTranslations('subscriptions');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [redeemPoints, { loading }] = useMutation(REDEEM_SUBSCRIPTION_POINTS);

  async function handleRedeem(formData: FormData) {
    setError(null);
    try {
      const { data } = await redeemPoints({
        variables: {
          input: {
            planId: plan.id,
            pointsToRedeem: plan.pointsCost,
            paymentMethodId: 'points',
          },
        },
      });

      if (data?.redeemSubscriptionPoints?.success) {
        toast({
          title: t('success.title'),
          description: t('success.redeemSuccess', { plan: plan.name }),
        });
        router.push(`/${locale}/account/subscriptions`);
      } else {
        setError(data?.redeemSubscriptionPoints?.message || t('errors.failedToRedeemPoints'));
      }
    } catch (err) {
      setError(t('errors.failedToRedeemPoints'));
      console.error('Redeem points error:', err);
    }
  }

  const SubmitButton = ({ children, ...props }: React.ComponentProps<typeof Button>) => {
    const { pending } = useFormStatus();
    return (
      <Button {...props} disabled={pending || loading || seller.pointsBalance < plan.pointsCost}>
        {pending || loading ? t('submitting') : children}
      </Button>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="h1-bold py-4">{t('redeem.title', { plan: plan.name })}</h1>
      <Card>
        <CardContent className="p-6">
          <p>{t('plan')}: {plan.name}</p>
          <p>{t('pointsRequired')}: {plan.pointsCost}</p>
          <p>{t('yourPointsBalance')}: {seller.pointsBalance}</p>
          {seller.pointsBalance < plan.pointsCost && (
            <p className="text-destructive">{t('errors.insufficientPoints')}</p>
          )}
          {error && <p className="text-destructive mt-2">{error}</p>}
        </CardContent>
        <CardFooter>
          <form action={handleRedeem} className="w-full">
            <input type="hidden" name="planId" value={plan.id} />
            <SubmitButton type="submit" className="w-full">
              {t('redeem.confirm')}
            </SubmitButton>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}