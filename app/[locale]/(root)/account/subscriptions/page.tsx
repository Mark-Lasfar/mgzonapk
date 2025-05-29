import React from 'react';
import { Metadata } from 'next';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { auth } from '@/auth';
import { getSellerByUserId, updateSellerSubscription } from '@/lib/actions/seller.actions';
import { createPaymentSession } from '@/lib/utils/payments';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';

const PAGE_TITLE = 'Subscription Plans';
export const metadata: Metadata = {
  title: PAGE_TITLE,
};

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

export default async function SubscriptionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  const sellerResult = await getSellerByUserId(session.user.id);
  const seller = sellerResult.success ? sellerResult.data : null;

  const { locale } = await getTranslations({ locale: 'en', namespace: 'subscriptions' });

  // Define subscription plans dynamically
  const subscriptionPlans: SubscriptionPlan[] = [
    {
      id: 'trial',
      name: 'Trial Plan',
      price: 1,
      pointsCost: 20,
      description: 'Trial plan for new sellers, $1/month for first 3 months.',
      features: { productsLimit: 50, commission: 7, prioritySupport: false, instantPayouts: false },
      isTrial: true,
      trialDuration: 3,
    },
    {
      id: 'basic',
      name: 'Basic Plan',
      price: 10,
      pointsCost: 200,
      description: 'Access to basic features, 100 product limit, 5% commission.',
      features: { productsLimit: 100, commission: 5, prioritySupport: false, instantPayouts: false },
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      price: 30,
      pointsCost: 600,
      description: 'Access to premium features, 500 product limit, 3% commission, priority support.',
      features: { productsLimit: 500, commission: 3, prioritySupport: true, instantPayouts: false },
    },
    {
      id: 'vip',
      name: 'VIP Plan',
      price: 100,
      pointsCost: 2000,
      description: 'Customized solutions, unlimited products, 1% commission, priority support, instant payouts.',
      features: { productsLimit: Infinity, commission: 1, prioritySupport: true, instantPayouts: true },
    },
  ];

  // Server action for redeeming points
  const handleRedeemPoints = async (formData: FormData) => {
    'use server';
    const planId = formData.get('planId') as string;
    const plan = subscriptionPlans.find((p) => p.id === planId);
    if (!plan) {
      return { success: false, message: 'Plan not found' };
    }

    try {
      const result = await updateSellerSubscription(session.user.id, plan.name as 'Trial' | 'Basic' | 'Pro' | 'VIP', plan.pointsCost);
      if (!result.success) {
        return { success: false, message: result.error || 'Failed to redeem points' };
      }
      return { success: true, message: `Subscribed to ${plan.name} using points` };
    } catch (error) {
      console.error('Redeem points error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Failed to redeem points' };
    }
  };

  // Server action for initiating payment
  const handlePayment = async (formData: FormData) => {
    'use server';
    const planId = formData.get('planId') as string;
    const method = formData.get('method') as 'stripe' | 'paypal';
    const plan = subscriptionPlans.find((p) => p.id === planId);
    if (!plan) {
      return { success: false, message: 'Plan not found' };
    }

    try {
      const sessionUrl = await createPaymentSession({
        userId: session.user.id,
        planId: plan.id,
        amount: plan.price,
        currency: 'USD',
        method,
      });
      return { success: true, redirectUrl: sessionUrl };
    } catch (error) {
      console.error('Payment error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Failed to initiate payment' };
    }
  };

  // الحصول على تاريخ اليوم
  const today = new Date();

  // مقارنة تاريخ التجديد (Renewal Date)
  const expirationDate = new Date(seller?.subscription?.endDate);
  const renewalDate = new Date(expirationDate);
  renewalDate.setMonth(renewalDate.getMonth() + 1); // تجديد الاشتراك بعد شهر

  const isExpired = renewalDate < today;
  const remainingDays = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="h1-bold py-4">{PAGE_TITLE}</h1>
      {seller ? (
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold">Current Subscription</h2>
            <p>Plan: {seller.subscription.plan}</p>
            <p>Status: {isExpired ? 'Expired' : 'Active'}</p>
            <p>End Date: {formatDateTime(expirationDate).dateOnly}</p>
            <p>Renewal Date: {formatDateTime(renewalDate).dateOnly}</p>
            {isExpired ? (
              <p className="text-red-500">Your subscription has expired.</p>
            ) : (
              <p className="text-green-500">Your subscription is still active. {remainingDays} days remaining.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8">
          <CardContent className="p-6">
            <p>No seller profile found. Please register as a seller first.</p>
          </CardContent>
        </Card>
      )}
      <div className="grid md:grid-cols-3 gap-4 items-stretch">
        {subscriptionPlans.map((plan) => (
          <Card key={plan.id}>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold">{plan.name}</h2>
              <p className="text-muted-foreground">
                {formatCurrency(plan.price)}/month or {plan.pointsCost} points
                {plan.isTrial && ' (first 3 months)'}
              </p>
              <p>{plan.description}</p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <form action={handleRedeemPoints}>
                <input type="hidden" name="planId" value={plan.id} />
                <Button type="submit" variant="outline" className="w-full" disabled={!seller}>
                  Redeem with Points
                </Button>
              </form>
              <form action={handlePayment}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="method" value="stripe" />
                <Button type="submit" className="w-full" disabled={!seller}>
                  Pay with Stripe
                </Button>
              </form>
              <form action={handlePayment}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="method" value="paypal" />
                <Button type="submit" className="w-full" disabled={!seller}>
                  Pay with PayPal
                </Button>
              </form>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
