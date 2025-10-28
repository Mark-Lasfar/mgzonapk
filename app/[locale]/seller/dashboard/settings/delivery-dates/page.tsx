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
import React, { useEffect, useMemo } from 'react';
import { useFieldArray, UseFormReturn } from 'react-hook-form';
import { SettingsFormData } from '@/lib/types/settings';

interface SellerDeliveryDateFormProps {
  form: UseFormReturn<SettingsFormData>;
  id: string;
  availableShippingProviders: Array<{ providerName: string }>; // From integrations of type 'shipping'
}

export default function SellerDeliveryDateForm({
  form,
  id,
  availableShippingProviders,
}: SellerDeliveryDateFormProps) {
  const t = useTranslations('SellerSettings.sections.shippingOptions');
  const { fields, append, remove } = useFieldArray<SettingsFormData>({
    control: form.control,
    name: 'shippingOptions',
  });

  const {
    setValue,
    watch,
    control,
    formState: { errors },
  } = form;

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
                name={`shippingOptions.${index}.name`}
                render={({ field }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>{t('name.label')}</FormLabel>}
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('name.placeholder')}
                      />
                    </FormControl>
                    <FormMessage>
                      {errors.shippingOptions?.[index]?.name?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`shippingOptions.${index}.daysToDeliver`}
                render={({ field }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>{t('daysToDeliver.label')}</FormLabel>}
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min="0"
                        placeholder={t('daysToDeliver.placeholder')}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage>
                      {errors.shippingOptions?.[index]?.daysToDeliver?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`shippingOptions.${index}.shippingPrice`}
                render={({ field }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>{t('shippingPrice.label')}</FormLabel>}
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={t('shippingPrice.placeholder')}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage>
                      {errors.shippingOptions?.[index]?.shippingPrice?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`shippingOptions.${index}.freeShippingMinPrice`}
                render={({ field }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>{t('freeShippingMinPrice.label')}</FormLabel>}
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={t('freeShippingMinPrice.placeholder')}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage>
                      {errors.shippingOptions?.[index]?.freeShippingMinPrice?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`shippingOptions.${index}.provider`}
                render={({ field }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>{t('provider.label')}</FormLabel>}
                    <FormControl>
                      <Select
                        value={field.value || ''}
                        onValueChange={(value) => field.onChange(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('provider.placeholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableShippingProviders.map((provider, idx) => (
                            <SelectItem key={idx} value={provider.providerName}>
                              {provider.providerName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage>
                      {errors.shippingOptions?.[index]?.provider?.message}
                    </FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`shippingOptions.${index}.isActive`}
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
                      {errors.shippingOptions?.[index]?.isActive?.message}
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
                name: '',
                daysToDeliver: 0,
                shippingPrice: 0,
                freeShippingMinPrice: 0,
                supportedCountries: [],
                isActive: true,
                provider: '',
              })
            }
          >
            {t('add')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}