'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { isValidIBAN } from 'iban';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { auth } from '@/auth';
import { decrypt } from '@/lib/utils/encryption';
import { updateBankInfo } from '@/lib/actions/seller.actions';
// import { updateBankInfo } from '@/app/seller.actions';

const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

const bankVerificationSchema = (t: any) =>
  z.object({
    accountName: z
      .string()
      .min(2, t('validation.accountName.min', { count: 2 }))
      .max(100, t('validation.accountName.max', { count: 100 })),
    accountNumber: z
      .string()
      .min(8, t('validation.accountNumber.min', { count: 8 }))
      .max(34, t('validation.accountNumber.max', { count: 34 }))
      .regex(/^[0-9A-Z]*$/, t('validation.accountNumber.format'))
      .refine((val) => isValidIBAN(val), t('validation.accountNumber.invalidIBAN')),
    bankName: z
      .string()
      .min(2, t('validation.bankName.min', { count: 2 }))
      .max(100, t('validation.bankName.max', { count: 100 })),
    swiftCode: z
      .string()
      .min(8, t('validation.swiftCode.min', { count: 8 }))
      .max(11, t('validation.swiftCode.max', { count: 11 }))
      .regex(SWIFT_REGEX, t('validation.swiftCode.invalidSwift')),
  });

interface BankVerificationPageProps {
  params: { locale: string };
}

export default function BankVerificationPage({ params: { locale } }: BankVerificationPageProps) {
  const t = useTranslations('bankVerification');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<ReturnType<typeof bankVerificationSchema>>>({
    resolver: zodResolver(bankVerificationSchema(t)),
    defaultValues: {
      accountName: '',
      accountNumber: '',
      bankName: '',
      swiftCode: '',
    },
  });

  useEffect(() => {
    const initializeForm = async () => {
      try {
        const session = await auth();
        if (!session?.user?.id) {
          router.push(`/${locale}/sign-in`);
          return;
        }

        // Fetch seller data via API route
        const response = await fetch(`/api/seller/${session.user.id}`);
        if (!response.ok) {
          setError(t('errors.sellerNotFound'));
          return;
        }

        const seller = await response.json();
        if (seller) {
          let decryptedAccountNumber = seller.bankInfo?.accountNumber || '';
          if (decryptedAccountNumber.includes(':')) {
            try {
              decryptedAccountNumber = await decrypt(decryptedAccountNumber);
            } catch (err) {
              console.error('Failed to decrypt account number:', err);
              setError(t('errors.decryptionFailed'));
              return;
            }
          }
          form.reset({
            accountName: seller.bankInfo?.accountName || '',
            accountNumber: decryptedAccountNumber,
            bankName: seller.bankInfo?.bankName || '',
            swiftCode: seller.bankInfo?.swiftCode || '',
          });
        } else {
          setError(t('errors.sellerNotFound'));
        }
      } catch (err) {
        console.error('Error fetching seller data:', err);
        setError(t('errors.serverError'));
      }
    };

    initializeForm();
  }, [form, locale, router, t]);

  async function onSubmit(data: z.infer<ReturnType<typeof bankVerificationSchema>>) {
    setIsLoading(true);
    setError(null);

    try {
      const session = await auth();
      if (!session?.user?.id) {
        router.push(`/${locale}/sign-in`);
        return;
      }

      // Verify bank details via API route
      const verificationResponse = await fetch('/api/verify-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iban: data.accountNumber, swift: data.swiftCode }),
      });
      const verificationResult = await verificationResponse.json();

      if (!verificationResult.valid) {
        setError(t('errors.externalVerificationFailed', { message: verificationResult.message }));
        setIsLoading(false);
        return;
      }

      // Update bank info via Server Action
      const result = await updateBankInfo(session.user.id, {
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankName: data.bankName,
        swiftCode: data.swiftCode,
      }, locale);

      if (!result.success) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      router.push(`/${locale}/account/subscriptions`);
    } catch (err: any) {
      console.error('Bank verification error:', err);
      setError(err.message || t('errors.serverError'));
    } finally {
      setIsLoading(false);
    }
  }

  if (error === t('errors.sellerNotFound')) {
    return (
      <div className="text-red-500 text-center p-4">
        {t('errors.sellerNotFound')}
        <br />
        <a href={`/${locale}/seller-registration`} className="text-blue-500 underline">
          {t('account.startSelling')}
        </a>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{t('title')}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-md mx-auto">
          <FormField
            control={form.control}
            name="accountName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('accountName')}</FormLabel>
                <FormControl>
                  <Input {...field} className="border rounded-md p-2" required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="accountNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('accountNumber')}</FormLabel>
                <FormControl>
                  <Input {...field} className="border rounded-md p-2" required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bankName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('bankName')}</FormLabel>
                <FormControl>
                  <Input {...field} className="border rounded-md p-2" required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="swiftCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('swiftCode')}</FormLabel>
                <FormControl>
                  <Input {...field} className="border rounded-md p-2" required />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
            disabled={isLoading}
          >
            {isLoading ? t('submitting') : t('submit')}
          </Button>
        </form>
      </Form>
    </div>
  );
}