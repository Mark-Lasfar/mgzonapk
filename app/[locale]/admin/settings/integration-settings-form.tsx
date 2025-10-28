'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/toast';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const integrationSettingsSchema = z.object({
  enableSandbox: z.boolean().default(false),
  webhookSecret: z.string().min(10, 'Webhook secret must be at least 10 characters').optional(),
  oauthRedirectBase: z.string().url('Invalid URL').optional(),
  defaultScopes: z.array(z.string()).optional(),
});

type IntegrationSettingsFormData = z.infer<typeof integrationSettingsSchema>;

export default function IntegrationSettingsForm({ settings }: { settings: any }) {
  const t = useTranslations('admin.settings.integrations');
  const { toast } = useToast();

  const form = useForm<IntegrationSettingsFormData>({
    resolver: zodResolver(integrationSettingsSchema),
    defaultValues: {
      enableSandbox: settings?.enableSandbox || false,
      webhookSecret: settings?.webhookSecret || '',
      oauthRedirectBase: settings?.oauthRedirectBase || '',
      defaultScopes: settings?.defaultScopes || [],
    },
  });

  const onSubmit = async (data: IntegrationSettingsFormData) => {
    try {
      const response = await fetch('/api/admin/settings/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update settings');
      toast({
        title: t('successTitle'),
        description: t('successMessage'),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: String(error),
      });
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="enableSandbox"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <FormLabel>{t('enableSandbox')}</FormLabel>
                    <p className="text-sm text-muted-foreground">{t('enableSandboxDescription')}</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="webhookSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('webhookSecret')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('webhookSecretPlaceholder')} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="oauthRedirectBase"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('oauthRedirectBase')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={t('oauthRedirectBasePlaceholder')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultScopes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('defaultScopes')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('defaultScopesPlaceholder')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value) {
                          field.onChange([...(field.value || []), e.currentTarget.value]);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </FormControl>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value?.map((scope: string) => (
                      <div key={scope} className="flex items-center bg-gray-100 px-2 py-1 rounded">
                        <span>{scope}</span>
                        <button
                          type="button"
                          onClick={() => field.onChange(field.value?.filter((s: string) => s !== scope))}
                          className="ml-2 text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">{t('submit')}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}