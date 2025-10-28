// SellerSubscriptionPage.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { CreditCard } from 'lucide-react';

interface SellerSubscriptionPageProps {
  params: { locale: string };
}

export default function SellerSubscriptionPage({ params: { locale } }: SellerSubscriptionPageProps) {
  const t = useTranslations('SellerDashboard');
  const { data: session, status } = useSession();
  const router = useRouter();
  const [seller, setSeller] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasRedirected = useRef(false);

  const supportedLocales = ['en', 'ar'];
  const validLocale = supportedLocales.includes(locale) ? locale : 'en';

  useEffect(() => {
    if (locale !== validLocale && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace(`/${validLocale}/seller/dashboard/subscription`);
      return;
    }

    async function initialize() {
      if (status === 'loading') return;
      if (status === 'unauthenticated') {
        router.push(`/${validLocale}/sign-in`);
        return;
      }

      if (session?.user?.id) {
        try {
          const response = await fetch('/api/seller/get', {
            headers: { Authorization: `Bearer ${session.user.token}` },
          });
          const result = await response.json();
          if (!result.success) {
            setError(t('errors.sellerNotFound'));
            setSeller(null);
          } else {
            setSeller(result.data);
          }
        } catch (err) {
          setError(t('errors.unexpectedError'));
          setSeller(null);
        }
      } else {
          setError(t('errors.unauthenticated'));
        }

        setIsLoading(false);
      }

      initialize();
    }, [session, status, validLocale, router, t]);

    const formSchema = z.object({
      plan: z.enum(['Trial', 'Basic', 'Pro', 'VIP']),
      pointsToRedeem: z.number().min(0).optional(),
      paymentMethod: z.enum(['stripe', 'paypal', 'points']).optional(),
      paymentDetails: z
        .object({
          cardNumber: z.string().optional(),
          expiry: z.string().optional(),
          cvc: z.string().optional(),
          paypalEmail: z.string().email().optional(),
        })
        .optional(),
    });

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        plan: seller?.subscription?.plan || 'Trial',
        pointsToRedeem: 0,
        paymentMethod: undefined,
        paymentDetails: {},
      },
    });

    async function onSubmit(data: z.infer<typeof formSchema>) {
      if (!session?.user?.id) {
        setSubmissionStatus({ type: 'error', message: t('errors.unauthenticated') });
        return;
      }

      if (isSubmitting) return;

      setIsSubmitting(true);
      setSubmissionStatus(null);

      try {
        const response = await fetch('/api/seller/subscription/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.user.token}`,
          },
          body: JSON.stringify({
            plan: data.plan,
            pointsToRedeem: data.pointsToRedeem || 0,
            paymentMethod: data.paymentMethod || 'stripe',
            paymentDetails: data.paymentDetails,
          }),
        });

        const result = await response.json();
        if (result.success) {
          setSubmissionStatus({
            type: 'success',
            message: t('subscriptions.updateSuccess', { plan: data.plan }),
          });
          form.reset(data);
        } else {
          setSubmissionStatus({
            type: 'error',
            message: result.error || t('errors.failedToUpdateSubscription'),
          });
        }
      } catch (error) {
        setSubmissionStatus({
          type: 'error',
          message: t('errors.unexpectedError'),
        });
      } finally {
        setIsSubmitting(false);
      }
    }

    if (isLoading) {
      return <div className="container mx-auto px-4 py-8">{t('loading')}</div>;
    }

    if (error || !seller) {
      return (
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">{t('subscriptionSettings')}</h1>
          <p className="text-red-600">{error || t('errors.sellerNotFound')}</p>
        </div>
      );
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('subscriptionSettings')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <h3 className="text-lg font-semibold">
                {t('subscriptions.currentPlan', { plan: seller.subscription.plan })}
              </h3>
              <p className="text-gray-600">{t('pointsBalance')}: {seller.pointsBalance}</p>
            </div>
            {submissionStatus && (
              <div
                className={`mb-4 p-4 rounded-md ${
                  submissionStatus.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {submissionStatus.message}
              </div>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="plan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('subscriptions.selectPlan')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('subscriptions.selectPlan')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subscriptionPlans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.name}>
                              {plan.name} (${plan.price}/month)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pointsToRedeem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('subscriptions.redeemPoints.pointsLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('subscriptions.selectMethod')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('subscriptions.selectMethod')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="stripe">Stripe</SelectItem>
                          <SelectItem value="paypal">PayPal</SelectItem>
                          <SelectItem value="points">Points</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch('paymentMethod') === 'stripe' && (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="paymentDetails.cardNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('subscriptions.cardNumber')}</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="1234 5678 9012 3456" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-4">
                      <FormField
                        control={form.control}
                        name="paymentDetails.expiry"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>{t('subscriptions.expiry')}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="MM/YY" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="paymentDetails.cvc"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>{t('subscriptions.cvc')}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="123" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
                {form.watch('paymentMethod') === 'paypal' && (
                  <FormField
                    control={form.control}
                    name="paymentDetails.paypalEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('subscriptions.paypalEmail')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="example@paypal.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('subscriptions.submitting') : t('subscriptions.submit')}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }