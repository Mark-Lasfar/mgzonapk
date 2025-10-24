// app/[locale]/(root)/seller/dashboard/settings/notifications/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Bell } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const formSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  orderUpdates: z.boolean(),
  marketingEmails: z.boolean(),
  pointsNotifications: z.boolean(),
});

type FormData = z.infer<typeof formSchema>;

interface SellerNotificationsSettingsPageProps {
  locale: string;
}

export default function SellerNotificationsSettingsPage({ 
  locale 
}: SellerNotificationsSettingsPageProps) {
  const t = useTranslations('SellerDashboard');
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: true,
      sms: false,
      orderUpdates: true,
      marketingEmails: false,
      pointsNotifications: true,
    },
  });

  // إعادة توجيه إذا مش مسجل دخول
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user?.id) {
      router.push(`/${locale}/sign-in`);
      return;
    }

    if (session.user.role !== 'SELLER') {
      router.push(`/${locale}/seller/dashboard`);
      return;
    }

    fetchSellerSettings();
  }, [status, session, locale, router]);

  const fetchSellerSettings = async () => {
    if (!session?.user?.token) return;

    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/settings`, {
        headers: {
          Authorization: `Bearer ${session.user.token}`,
        },
      });

      if (!res.ok) {
        throw new Error(t('errors.fetchFailed'));
      }

      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.message || t('errors.fetchFailed'));
      }

      // تحديث الـ form بالبيانات الموجودة
      const notifications = data.data.settings?.notifications || {};
      form.reset({
        email: notifications.email ?? true,
        sms: notifications.sms ?? false,
        orderUpdates: notifications.orderUpdates ?? true,
        marketingEmails: notifications.marketingEmails ?? false,
        pointsNotifications: notifications.pointsNotifications ?? true,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.fetchFailed');
      setError(errorMessage);
      toast({
        title: t('errors.title'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const logError = async (message: string, error: string) => {
    try {
      if (!session?.user?.id) return;
      
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'error',
          message,
          error,
          meta: { userId: session.user.id },
        }),
      });
    } catch (err) {
      console.error('Failed to log error:', err);
    }
  };

  const logInfo = async (message: string, meta: Record<string, any> = {}) => {
    try {
      if (!session?.user?.id) return;
      
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'info',
          message,
          meta: { userId: session.user.id, ...meta },
        }),
      });
    } catch (err) {
      console.error('Failed to log info:', err);
    }
  };

  async function onSubmit(data: FormData) {
    if (!session?.user?.token) {
      toast({
        title: t('errors.title'),
        description: t('errors.unauthenticated'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitLoading(true);
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/seller/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.user.token}`,
        },
        body: JSON.stringify({ 
          settings: { 
            notifications: data 
          } 
        }),
      });

      const result = await res.json();
      
      if (!result.success) {
        throw new Error(result.error || t('errors.updateFailed'));
      }

      toast({
        title: t('success.title'),
        description: t('updateSuccess'),
      });

      await logInfo('Seller notifications updated successfully', { 
        userId: session.user.id 
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('errors.updateFailed');
      setError(errorMessage);
      toast({
        title: t('errors.title'),
        description: errorMessage,
        variant: 'destructive',
      });
      await logError('Failed to update seller notifications', errorMessage);
    } finally {
      setSubmitLoading(false);
    }
  }

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
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
            <p className="text-red-600">{error}</p>
            <Button 
              onClick={fetchSellerSettings} 
              className="mt-4"
            >
              {t('retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
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
                  <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <FormLabel>{t('notifications.email')}</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {t('notifications.emailDescription')}
                      </p>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        disabled={submitLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="sms"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <FormLabel>{t('notifications.sms')}</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {t('notifications.smsDescription')}
                      </p>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        disabled={submitLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="orderUpdates"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <FormLabel>{t('notifications.orderUpdates')}</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {t('notifications.orderUpdatesDescription')}
                      </p>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        disabled={submitLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="marketingEmails"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <FormLabel>{t('notifications.marketingEmails')}</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {t('notifications.marketingEmailsDescription')}
                      </p>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        disabled={submitLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="pointsNotifications"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <FormLabel>{t('notifications.pointsNotifications')}</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        {t('notifications.pointsNotificationsDescription')}
                      </p>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                        disabled={submitLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                disabled={submitLoading || status !== 'authenticated'}
                className="w-full"
              >
                {submitLoading ? t('saving') : t('save')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}