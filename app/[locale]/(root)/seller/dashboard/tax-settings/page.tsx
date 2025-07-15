'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const taxSettingsSchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/, 'Invalid country code'),
  taxType: z.enum(['VAT', 'GST', 'SalesTax', 'none']),
  taxRate: z.number().min(0, 'Tax rate cannot be negative'),
  taxService: z.enum(['TaxJar', 'Avalara', 'Quaderno', 'none']),
});

type TaxSettingsForm = z.infer<typeof taxSettingsSchema>;

export default function TaxSettingsPage() {
  const t = useTranslations('seller.tax_settings');
  const { toast } = useToast();
  const [taxSettings, setTaxSettings] = useState<TaxSettingsForm[]>([]);

  const form = useForm<TaxSettingsForm>({
    resolver: zodResolver(taxSettingsSchema),
    defaultValues: {
      countryCode: '',
      taxType: 'none',
      taxRate: 0,
      taxService: 'none',
    },
  });

  const onSubmit = async (data: TaxSettingsForm) => {
    try {
      const res = await fetch('/api/seller/tax-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error('Failed to save tax settings');
      }
      setTaxSettings([...taxSettings, data]);
      toast({
        title: t('success.title'),
        description: t('success.message'),
      });
      form.reset();
    } catch (error) {
      toast({
        title: t('error.title'),
        description: t('error.message'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="countryCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('country_code')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('country_code_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tax_type')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_tax_type')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['VAT', 'GST', 'SalesTax', 'none'].map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`tax_types.${type}`)}
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
                name="taxRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tax_rate')}</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder={t('tax_rate_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="taxService"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('tax_service')}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('select_tax_service')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {['TaxJar', 'Avalara', 'Quaderno', 'none'].map((service) => (
                          <SelectItem key={service} value={service}>
                            {t(`tax_services.${service}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">{t('save')}</Button>
            </form>
          </Form>
          <div className="mt-6">
            <h3 className="text-lg font-semibold">{t('current_settings')}</h3>
            {taxSettings.map((setting, index) => (
              <div key={index} className="p-4 border rounded mt-2">
                <p>{t('country_code')}: {setting.countryCode}</p>
                <p>{t('tax_type')}: {setting.taxType}</p>
                <p>{t('tax_rate')}: {setting.taxRate}%</p>
                <p>{t('tax_service')}: {setting.taxService}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}