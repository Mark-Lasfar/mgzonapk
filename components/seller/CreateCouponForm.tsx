'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { v4 as uuidv4 } from 'uuid';

interface CouponFormData {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  validUntil?: string;
}

export default function CreateCouponForm() {
  const t = useTranslations('createCoupon');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CouponFormData>({
    defaultValues: {
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: 0,
      minPurchase: 0,
      validUntil: '',
    },
  });

  const onSubmit = async (data: CouponFormData) => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/seller/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, id: uuidv4() }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.error || t('errors.createFailed'));
        return;
      }
      setSuccess(t('success'));
      reset();
    } catch (err) {
      setError(t('errors.createFailed'));
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="code">{t('code')}</Label>
            <Input
              id="code"
              {...register('code', { required: t('errors.codeRequired'), minLength: { value: 3, message: t('errors.codeMinLength') } })}
            />
            {errors.code && <p className="text-red-500 text-sm">{errors.code.message}</p>}
          </div>
          <div>
            <Label htmlFor="description">{t('description')}</Label>
            <Input
              id="description"
              {...register('description', { required: t('errors.descriptionRequired') })}
            />
            {errors.description && <p className="text-red-500 text-sm">{errors.description.message}</p>}
          </div>
          <div>
            <Label htmlFor="discountType">{t('discountType')}</Label>
            <select
              id="discountType"
              {...register('discountType', { required: t('errors.discountTypeRequired') })}
              className="w-full border rounded p-2"
            >
              <option value="percentage">{t('percentage')}</option>
              <option value="fixed">{t('fixed')}</option>
            </select>
            {errors.discountType && <p className="text-red-500 text-sm">{errors.discountType.message}</p>}
          </div>
          <div>
            <Label htmlFor="discountValue">{t('discountValue')}</Label>
            <Input
              id="discountValue"
              type="number"
              {...register('discountValue', { required: t('errors.discountValueRequired'), min: { value: 1, message: t('errors.discountValueMin') } })}
            />
            {errors.discountValue && <p className="text-red-500 text-sm">{errors.discountValue.message}</p>}
          </div>
          <div>
            <Label htmlFor="minPurchase">{t('minPurchase')}</Label>
            <Input
              id="minPurchase"
              type="number"
              {...register('minPurchase', { min: { value: 0, message: t('errors.minPurchaseMin') } })}
            />
            {errors.minPurchase && <p className="text-red-500 text-sm">{errors.minPurchase.message}</p>}
          </div>
          <div>
            <Label htmlFor="validUntil">{t('validUntil')}</Label>
            <Input
              id="validUntil"
              type="date"
              {...register('validUntil')}
            />
          </div>
          {error && <p className="text-red-500">{error}</p>}
          {success && <p className="text-green-500">{success}</p>}
          <Button type="submit">{t('submit')}</Button>
        </form>
      </CardContent>
    </Card>
  );
}