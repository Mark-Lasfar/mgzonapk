// /home/mark/Music/my-nextjs-project-clean/components/account/subscriptions/Checkout.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@apollo/client/react';
import { GET_PAYMENT_METHODS, UPDATE_SUBSCRIPTION } from '@/graphql/subscription/queries';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutProps {
  plan: {
    id: string;
    name: string;
    price: number;
  };
  locale: string;
  userId: string;
}

export default function Checkout({ plan, locale, userId }: CheckoutProps) {
  const t = useTranslations('subscriptions');
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<{ id: string; providerName: string }[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data: methodsData, loading: methodsLoading } = useQuery(GET_PAYMENT_METHODS, {
    variables: { userId },
  });

  const [updateSubscription, { loading: updateLoading }] = useMutation(UPDATE_SUBSCRIPTION);

  useEffect(() => {
    if (methodsData?.paymentMethods) {
      setPaymentMethods(methodsData.paymentMethods);
      if (methodsData.paymentMethods.length === 0) {
        setSelectedMethod('stripe'); // Default to Stripe if no methods
      }
    }
  }, [methodsData]);

  useEffect(() => {
    if (selectedMethod && selectedMethod !== 'points') {
      // Initialize payment session
      const initializePayment = async () => {
        try {
          const response = await fetch('/api/payment/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              planId: plan.id,
              amount: plan.price,
              currency: 'USD',
              method: selectedMethod,
              paymentGatewayId: paymentMethods.find((m) => m.providerName === selectedMethod)?.id || 'stripe',
            }),
          });
          const data = await response.json();
          if (data.success && data.paymentUrl) {
            setClientSecret(data.paymentUrl);
          } else {
            setError(t('errors.paymentFailed'));
          }
        } catch (err) {
          setError(t('errors.serverError'));
          console.error('Payment initialization error:', err);
        }
      };
      initializePayment();
    }
  }, [selectedMethod, plan.id, plan.price, userId, paymentMethods, t]);

  const handlePayment = async () => {
    setError(null);
    if (!stripe || !elements || !clientSecret) {
      setError(t('errors.paymentNotInitialized'));
      return;
    }

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message);
        return;
      }

      const { error: paymentError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/${locale}/account/subscriptions?success=true`,
        },
      });

      if (paymentError) {
        setError(paymentError.message || t('errors.paymentFailed'));
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        await updateSubscription({
          variables: {
            input: {
              planId: plan.id,
              paymentMethodId: selectedMethod,
              paymentDetails: { token: paymentIntent.id },
            },
          },
        });
        toast({
          title: t('success.title'),
          description: t('success.paymentSuccess', { plan: plan.name }),
        });
        router.push(`/${locale}/account/subscriptions`);
      }
    } catch (err) {
      setError(t('errors.paymentFailed'));
      console.error('Payment error:', err);
    }
  };

  if (methodsLoading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <h1 className="h1-bold py-4">{t('checkout.title', { plan: plan.name })}</h1>
      <Card>
        <CardContent className="p-6">
          <p>{t('plan')}: {plan.name}</p>
          <p>{t('price')}: ${plan.price}</p>
          <div className="mt-4">
            <h3>{t('selectPaymentMethod')}</h3>
            {paymentMethods.length === 0 ? (
              <p>{t('noPaymentMethods')} (Using Stripe)</p>
            ) : (
              paymentMethods.map((method) => (
                <Button
                  key={method.id}
                  variant={selectedMethod === method.providerName ? 'default' : 'outline'}
                  onClick={() => setSelectedMethod(method.providerName)}
                  className="mr-2"
                >
                  {method.providerName}
                </Button>
              ))
            )}
          </div>
          {clientSecret && selectedMethod === 'stripe' && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentElement />
            </Elements>
          )}
          {error && <p className="text-destructive mt-2">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={handlePayment}
            disabled={updateLoading || !selectedMethod || !clientSecret}
          >
            {updateLoading ? <Loader2 className="animate-spin" /> : t('checkout.confirm')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}