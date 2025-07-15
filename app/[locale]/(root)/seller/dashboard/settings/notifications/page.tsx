'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Bell } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

const formSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  orderUpdates: z.boolean(),
  marketingEmails: z.boolean(),
  pointsNotifications: z.boolean(),
});

export default function SellerNotificationsSettingsPage({
  params,
}: {
  params: { locale: string };
}) {
  const t = useTranslations('SellerDashboard');
  const { data: session, status } = useSession();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: true,
      sms: false,
      orderUpdates: true,
      marketingEmails: false,
      pointsNotifications: true,
    },
  });

  const logError = async (message: string, error: string) => {
    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          message,
          error,
          meta: { userId: session?.user?.id || 'anonymous' },
        }),
      });
    } catch (err) {
      console.error('Failed to log error:', err);
    }
  };

  const logInfo = async (message: string, meta: Record<string, any> = {}) => {
    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'info',
          message,
          meta: { userId: session?.user?.id || 'anonymous', ...meta },
        }),
      });
    } catch (err) {
      console.error('Failed to log info:', err);
    }
  };

  useEffect(() => {
    async function fetchSeller() {
      if (status !== 'authenticated' || session?.user?.role !== 'SELLER') {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch('/api/seller');
        if (!res.ok) throw new Error(t('errors.fetchFailed'));
        const data = await res.json();
        if (!data.success) throw new Error(data.message || t('errors.fetchFailed'));
        form.reset(data.data.settings.notifications || {});
        await logInfo('Fetched seller settings', { userId: session?.user?.id });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : t('errors.fetchFailed');
        setError(errorMessage);
        toast({ description: errorMessage, variant: 'destructive' });
        await logError('Failed to fetch seller settings', errorMessage);
      } finally {
        setLoading(false);
      }
    }
    fetchSeller();
  }, [t, status, session, form]);

  async function onSubmit(data: z.infer<typeof formSchema>) {
    try {
      setLoading(true);
      const res = await fetch('/api/seller/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { notifications: data } }),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || t('errors.updateFailed'));
      }
      toast({ description: t('updateSuccess') });
      await logInfo('Seller notifications updated', { userId: session?.user?.id });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.updateFailed');
      setError(errorMessage);
      toast({ description: errorMessage, variant: 'destructive' });
      await logError('Failed to update notifications', errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading' || loading) {
    return <div className="container mx-auto px-4 py-8">{t('loading')}</div>;
  }

  if (status === 'unauthenticated') {
    return <div className="container mx-auto px-4 py-8">{t('errors.unauthenticated')}</div>;
  }

  if (session?.user?.role !== 'SELLER') {
    return <div className="container mx-auto px-4 py-8">{t('errors.accessDenied')}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            {t('notificationSettings')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>{t('notifications.email')}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sms"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>{t('notifications.sms')}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orderUpdates"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>{t('notifications.orderUpdates')}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="marketingEmails"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>{t('notifications.marketingEmails')}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pointsNotifications"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel>{t('notifications.pointsNotifications')}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loading}>
                {t('save')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}