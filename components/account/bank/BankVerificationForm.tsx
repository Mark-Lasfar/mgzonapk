// /home/mark/Music/my-nextjs-project-clean/components/account/bank/BankVerificationForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { useMutation } from '@apollo/client/react';
import { UPDATE_BANK_INFO } from '@/graphql/bank/mutations';
import BankVerificationStatus from './BankVerificationStatus';

interface BankInfo {
  accountName: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
  routingNumber: string;
  bankDocumentUrl?: string;
  isVerified: boolean;
}

interface BankVerificationFormProps {
  bankInfo: BankInfo;
}

const formSchema = z.object({
  accountName: z.string().min(2, { message: 'accountName.min' }).max(100, { message: 'accountName.max' }),
  accountNumber: z.string().min(8, { message: 'accountNumber.min' }).max(34, { message: 'accountNumber.max' }),
  bankName: z.string().min(2, { message: 'bankName.min' }).max(100, { message: 'bankName.max' }),
  swiftCode: z
    .string()
    .min(8, { message: 'swiftCode.min' })
    .max(11, { message: 'swiftCode.max' })
    .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, { message: 'swiftCode.invalid' }),
  routingNumber: z
    .string()
    .regex(/^\d{9}$/, { message: 'routingNumber.invalid' })
    .optional(),
  bankDocumentUrl: z.string().url({ message: 'bankDocumentUrl.invalid' }).optional(),
});

export default function BankVerificationForm({ bankInfo }: BankVerificationFormProps) {
  const t = useTranslations('SellerDashboard');
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountName: bankInfo.accountName || '',
      accountNumber: bankInfo.accountNumber || '',
      bankName: bankInfo.bankName || '',
      swiftCode: bankInfo.swiftCode || '',
      routingNumber: bankInfo.routingNumber || '',
      bankDocumentUrl: bankInfo.bankDocumentUrl || '',
    },
  });

  const [updateBankInfo, { loading }] = useMutation(UPDATE_BANK_INFO, {
    onCompleted: () => {
      toast({
        title: t('messages.bankInfoUpdated'),
        description: t('messages.bankInfoUpdatedMessage'),
      });
      router.refresh();
    },
    onError: (error) => {
      toast({
        title: t('errors.failedToUpdateBankInfo'),
        description: error.message || t('errors.serverError'),
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      await updateBankInfo({
        variables: { input: data },
      });
    } catch (error) {
      console.error('Error submitting bank info:', error);
    }
  };

  return (
    <div>
      <BankVerificationStatus isVerified={bankInfo.isVerified} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="accountName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('accountName.label')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('accountName.placeholder')}
                    disabled={bankInfo.isVerified}
                    className={bankInfo.isVerified ? 'bg-gray-100' : ''}
                  />
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
                <FormLabel>{t('accountNumber.label')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('accountNumber.placeholder')}
                    disabled={bankInfo.isVerified}
                    type={bankInfo.isVerified ? 'password' : 'text'}
                    className={bankInfo.isVerified ? 'bg-gray-100' : ''}
                  />
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
                <FormLabel>{t('bankName.label')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('bankName.placeholder')}
                    disabled={bankInfo.isVerified}
                    className={bankInfo.isVerified ? 'bg-gray-100' : ''}
                  />
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
                <FormLabel>{t('swiftCode.label')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('swiftCode.placeholder')}
                    disabled={bankInfo.isVerified}
                    className={bankInfo.isVerified ? 'bg-gray-100' : ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="routingNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('routingNumber.label')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('routingNumber.placeholder')}
                    disabled={bankInfo.isVerified}
                    className={bankInfo.isVerified ? 'bg-gray-100' : ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bankDocumentUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('bankDocumentUrl.label')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t('bankDocumentUrl.placeholder')}
                    disabled={bankInfo.isVerified}
                    className={bankInfo.isVerified ? 'bg-gray-100' : ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={loading || bankInfo.isVerified}>
            {loading ? t('loading') : bankInfo.isVerified ? t('bankInfoVerified') : t('submit')}
          </Button>
        </form>
      </Form>
    </div>
  );
}