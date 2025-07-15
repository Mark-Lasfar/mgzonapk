import { Metadata } from 'next';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { auth } from '@/auth';
import { updateSellerSubscription } from '@/lib/actions/seller.actions';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { subscriptionPlans } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Redeem Points for Subscription',
};

export default async function RedeemPointsPage({ searchParams }: { searchParams: { planId?: string } }) {
  const t = await getTranslations('subscriptions');
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  await connectToDatabase();
  const seller = await Seller.findOne({ userId: session.user.id });
  if (!seller) {
    return <div>{t('errors.sellerNotFound')}</div>;
  }

  const planId = searchParams.planId;
  const plan = subscriptionPlans.find((p) => p.id === planId);
  if (!plan) {
    return <div>{t('errors.invalidPlan')}</div>;
  }

  async function handleRedeem(formData: FormData) {
    'use server';
    try {
      const result = await updateSellerSubscription(
        session.user.id,
        {
          plan: plan.id,
          pointsToRedeem: plan.pointsCost,
          paymentMethod: 'points',
        },
        'en'
      );
      if (!result.success) {
        return { success: false, message: result.error || t('errors.failedToRedeemPoints') };
      }
      redirect('/account/subscriptions');
    } catch {
      return { success: false, message: t('errors.failedToRedeemPoints') };
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="h1-bold py-4">{t('redeem.title', { plan: plan.name })}</h1>
      <Card>
        <CardContent className="p-6">
          <p>{t('plan')}: {plan.name}</p>
          <p>{t('pointsRequired')}: {plan.pointsCost}</p>
          <p>{t('yourPointsBalance')}: {seller.pointsBalance}</p>
          {seller.pointsBalance < plan.pointsCost && (
            <p className="text-destructive">{t('errors.insufficientPoints')}</p>
          )}
        </CardContent>
        <CardFooter>
          <form action={handleRedeem}>
            <Button
              type="submit"
              className="w-full"
              disabled={seller.pointsBalance < plan.pointsCost}
            >
              {t('redeem.confirm')}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}