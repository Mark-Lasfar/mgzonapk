// app/[locale]/(root)/seller/dashboard/settings/account/SellerAccountForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';

interface SellerAccountFormProps {
  seller: {
    businessName: string;
    email: string;
    phone: string;
    description?: string;
    address: {
      street: string;
      city: string;
      state?: string;
      postalCode: string;
      countryCode: string;
    };
  };
  onSubmit: (data: z.infer<typeof formSchema>) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

const formSchema = z.object({
  businessName: z
    .string()
    .min(2, { message: 'businessName.min' })
    .max(100, { message: 'businessName.max' }),
  email: z.string().email({ message: 'email.invalid' }),
  phone: z
    .string()
    .min(10, { message: 'phone.min' })
    .max(15, { message: 'phone.max' }),
  description: z
    .string()
    .min(10, { message: 'description.min' })
    .max(500, { message: 'description.max' })
    .optional(),
  address: z.object({
    street: z.string().min(1, { message: 'address.street.required' }),
    city: z.string().min(1, { message: 'address.city.required' }),
    state: z.string().min(1, { message: 'address.state.required' }),
    countryCode: z.string().regex(/^[A-Z]{2}$/, { message: 'address.country.required' }),
    postalCode: z.string().min(1, { message: 'address.postalCode.required' }),
  }),
});

export default function SellerAccountForm({ seller, onSubmit }: SellerAccountFormProps) {
  const t = useTranslations('SellerDashboard');
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      businessName: seller.businessName,
      email: seller.email,
      phone: seller.phone,
      description: seller.description || '',
      address: {
        street: seller.address.street,
        city: seller.address.city,
        state: seller.address.state || '',
        countryCode: seller.address.countryCode,
        postalCode: seller.address.postalCode,
      },
    },
  });

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    const result = await onSubmit(data);
    if (result.success) {
      toast({
        title: t('messages.settingsUpdatedTitle'),
        description: t('messages.settingsUpdatedMessage'),
      });
    } else {
      toast({
        title: t('errors.failedToUpdateSettings'),
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="businessName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('businessName.label')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('businessName.placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email.label')}</FormLabel>
              <FormControl>
                <Input {...field} type="email" placeholder={t('email.placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('phone.label')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('phone.placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('description.label')}</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder={t('description.placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('address.label')}</h3>
          <FormField
            control={form.control}
            name="address.street"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('address.street.label')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('address.street.placeholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address.city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('address.city.label')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('address.city.placeholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address.state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('address.state.label')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('address.state.placeholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address.countryCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('address.country.label')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('address.country.placeholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address.postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('address.postalCode.label')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('address.postalCode.placeholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {t('submit')}
        </Button>
      </form>
    </Form>
  );
}