'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import StripeForm from '../../checkout/[id]/stripe-form';
import { useState, useEffect } from 'react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

export default function PremiumPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations('Premium');
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<{ price: number; description: string; image: string } | null>(null);

  useEffect(() => {
    const fetchAISettings = async () => {
      try {
        const response = await fetch('/api/settings/ai');
        if (!response.ok) {
          throw new Error('Failed to fetch AI settings');
        }
        const data = await response.json();
        setAiSettings(data);
      } catch (error) {
        toast({ description: t('fetchSettingsError'), variant: 'destructive' });
      }
    };
    fetchAISettings();
  }, [t]);

  const handleSubscribe = async () => {
    try {
      const response = await fetch('/api/seller/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sellerId: 'SELLER_ID' }), // استبدل بـ currentSellerId من السياق
      });

      if (!response.ok) {
        throw new Error('Failed to create subscription');
      }

      const data = await response.json();
      setClientSecret(data.clientSecret);
      toast({ description: t('subscriptionStarted') });
    } catch (error) {
      toast({ description: t('subscriptionError'), variant: 'destructive' });
    }
  };

  if (!aiSettings) {
    return <div>Loading...</div>;
  }

  return (
    <main className="max-w-6xl mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <img src={aiSettings.image} alt="AI Assistant" className="w-full h-48 object-cover rounded" />
            <p>{aiSettings.description}</p>
            <ul className="list-disc pl-5">
              <li>{t('feature1')}</li>
              <li>{t('feature2')}</li>
              <li>{t('feature3')}</li>
              <li>{t('feature4')}</li>
            </ul>
            <p className="font-bold">{t('price', { amount: aiSettings.price })}</p>
            {!clientSecret ? (
              <Button onClick={handleSubscribe} className="w-full rounded-full">
                {t('subscribeButton')}
              </Button>
            ) : (
              <Elements options={{ clientSecret }} stripe={stripePromise}>
                <StripeForm priceInCents={aiSettings.price * 100} orderId="ai-assistant-subscription" />
              </Elements>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}