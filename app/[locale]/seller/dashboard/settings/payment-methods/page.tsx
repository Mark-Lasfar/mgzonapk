'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import { TrashIcon } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { SettingsFormData } from '@/lib/types/settings';
import { useToast } from '@/components/ui/toast';

interface SellerPaymentMethodFormProps {
  id: string;
  form: UseFormReturn<SettingsFormData>;
  availablePaymentProviders: Array<{ providerName: string }>;
}

export default function SellerPaymentMethodForm({
  form,
  id,
}: SellerPaymentMethodFormProps) {
  const t = useTranslations('SellerSettings.sections.paymentMethods');
  const { toast } = useToast();
  const [availablePaymentProviders, setAvailablePaymentProviders] = useState<
    Array<{ providerName: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const { fields, append, remove } = useFieldArray<SettingsFormData>({
    control: form.control,
    name: 'paymentGateways',
  });

  const {
    setValue,
    watch,
    control,
    formState: { errors },
  } = form;

  const paymentGateways = watch('paymentGateways');
  const defaultPaymentGateway = watch('defaultPaymentGateway');

  // Fetch available payment integrations
  useEffect(() => {
    const fetchPaymentIntegrations = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/seller/integrations?type=payment');
        if (!response.ok) throw new Error(t('Fetch Error'));
        const { data } = await response.json();
        setAvailablePaymentProviders(
          data
            .filter((int: any) => int.type === 'payment' && int.status === 'connected')
            .map((int: any) => ({ providerName: int.providerName }))
        );
      } catch (error) {
        toast({
          variant: 'destructive',
          title: t('errors.fetchFailed'),
          description: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPaymentIntegrations();
  }, [t, toast]);

  // Memoize valid payment gateways
  const validPaymentGateways = useMemo(
    () => paymentGateways?.map((gateway) => gateway.providerName) || [],
    [paymentGateways]
  );

  // Ensure defaultPaymentGateway is valid
  useEffect(() => {
    if (
      defaultPaymentGateway &&
      !validPaymentGateways.includes(defaultPaymentGateway)
    ) {
      setValue('defaultPaymentGateway', validPaymentGateways[0] || '');
    }
  }, [validPaymentGateways, defaultPaymentGateway, setValue]);

  if (isLoading) {
    return <div>{t('loading')}</div>;
  }

  return (
    <Card id={id}>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="flex gap-2">
              <FormField
                control={form.control}
                name={`paymentGateways.${index}.providerName`}
                render={({ field }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>{t('providerName.label')}</FormLabel>}
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={(value) => field.onChange(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('providerName.placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePaymentProviders.map((provider, idx) => (
                            <SelectItem key={idx} value={provider.providerName}>
                              {provider.providerName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage>
                      {errors.paymentGateways?.[index]?.providerName?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`paymentGateways.${index}.commission`}
                render={({ field }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>{t('commission.label')}</FormLabel>}
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder={t('commission.placeholder')}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage>
                      {errors.paymentGateways?.[index]?.commission?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`paymentGateways.${index}.isActive`}
                render={({ field }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>{t('isActive.label')}</FormLabel>}
                    <FormControl>
                      <Select
                        value={field.value ? 'true' : 'false'}
                        onValueChange={(value) => field.onChange(value === 'true')}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('isActive.placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">{t('isActive.options.enabled')}</SelectItem>
                          <SelectItem value="false">{t('isActive.options.disabled')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage>
                      {errors.paymentGateways?.[index]?.isActive?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <div>
                {index === 0 && <div>{t('action')}</div>}
                <Button
                  type="button"
                  disabled={fields.length === 1}
                  variant="outline"
                  className={index === 0 ? 'mt-2' : ''}
                  onClick={() => remove(index)}
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              append({
                providerName: '',
                commission: 0,
                isActive: true,
                verified: false,
                isDefault: false,
                isInternal: false,
                sandbox: false,
              })
            }
          >
            {t('add')}
          </Button>
        </div>

        <FormField
          control={control}
          name="defaultPaymentGateway"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('defaultPaymentGateway.label')}</FormLabel>
              <FormControl>
                <Select
                  value={field.value || ''}
                  onValueChange={(value) => field.onChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('defaultPaymentGateway.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentGateways
                      ?.filter((x) => x.providerName && x.isActive)
                      .map((gateway, index) => (
                        <SelectItem key={index} value={gateway.providerName}>
                          {gateway.providerName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage>{errors.defaultPaymentGateway?.message}</FormMessage>
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}