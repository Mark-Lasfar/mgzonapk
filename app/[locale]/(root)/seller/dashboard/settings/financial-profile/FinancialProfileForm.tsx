'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { updateBankInfo } from '@/lib/actions/bank.actions';

interface BankInfo {
  accountName: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
  isVerified: boolean;
}

interface FinancialProfileFormProps {
  bankInfo: BankInfo;
}

const formSchema = z.object({
  accountName: z.string().min(2, { message: 'accountName.min' }).max(100, { message: 'accountName.max' }),
  accountNumber: z.string().min(8, { message: 'accountNumber.min' }).max(34, { message: 'accountNumber.max' }),
  bankName: z.string().min(2, { message: 'bankName.min' }).max(100, { message: 'bankName.max' }),
  swiftCode: z.string().min(8, { message: 'swiftCode.min' }).max(11, { message: 'swiftCode.max' }).regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, { message: 'swiftCode.invalid' }),
});

export default function FinancialProfileForm({ bankInfo }: FinancialProfileFormProps) {
  const t = useTranslations('SellerDashboard');
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountName: bankInfo.accountName || '',
      accountNumber: bankInfo.accountNumber || '',
      bankName: bankInfo.bankName || '',
      swiftCode: bankInfo.swiftCode || '',
    },
  });

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    const result = await updateBankInfo(data);
    if (result.success) {
      toast({
        title: t('messages.bankInfoUpdated'),
        description: t('messages.bankInfoUpdatedMessage'),
      });
    } else {
      toast({
        title: t('errors.failedToUpdateBankInfo'),
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <p className="text-sm text-gray-600">
          {t('messages.bankInfoNote')} {/* ملاحظة: هذا الحقل مطلوب فقط لاستخدام بوابة mgpay الداخلية. البوابات الخارجية مثل Stripe أو PayPal تتحقق من الحساب البنكي مباشرة. */}
        </p>
        <FormField
          control={form.control}
          name="accountName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('accountName.label')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('accountName.placeholder')} />
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
                <Input {...field} placeholder={t('accountNumber.placeholder')} />
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
                <Input {...field} placeholder={t('bankName.placeholder')} />
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
                <Input {...field} placeholder={t('swiftCode.placeholder')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting || bankInfo.isVerified}>
          {bankInfo.isVerified ? t('bankInfoVerified') : t('submit')}
        </Button>
      </form>
    </Form>
  );
}