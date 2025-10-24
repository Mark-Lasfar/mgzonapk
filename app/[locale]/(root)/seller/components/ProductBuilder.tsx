// /app/seller/components/ProductBuilder.tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { ProductInputSchema } from '@/lib/validator';

type ProductFormValues = z.infer<typeof ProductInputSchema>;

interface ProductBuilderProps {
  product?: ProductFormValues;
  onSubmitSuccess?: () => void;
}

export default function ProductBuilder({ product, onSubmitSuccess }: ProductBuilderProps) {
  const t = useTranslations('seller.productBuilder');
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(ProductInputSchema),
    defaultValues: product || {
      name: '',
      slug: '',
      category: '',
      images: [],
      brand: '',
      description: '',
      isPublished: false,
      price: 0,
      listPrice: 0,
      countInStock: 0,
      tags: [],
      sizes: [],
      avgRating: 0,
      numReviews: 0,
      ratingDistribution: [],
      reviews: [],
      numSales: 0,
    },
  });

  const onSubmit = async (data: ProductFormValues) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(product ? `/api/product/${product._id}` : '/api/product', {
        method: product ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (result.success) {
        toast({ description: t(product ? 'updateSuccess' : 'createSuccess') });
        form.reset();
        if (onSubmitSuccess) onSubmitSuccess();
      } else {
        throw new Error(result.message || t('submitFailed'));
      }
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : t('submitFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('name')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('namePlaceholder')} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('slug')}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('slugPlaceholder')} disabled={isSubmitting} />
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
              <FormLabel>{t('description')}</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder={t('descriptionPlaceholder')} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('price')}</FormLabel>
              <FormControl>
                <Input type="number" {...field} placeholder={t('pricePlaceholder')} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="countInStock"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('countInStock')}</FormLabel>
              <FormControl>
                <Input type="number" {...field} placeholder={t('countInStockPlaceholder')} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('submitting') : t(product ? 'update' : 'create')}
        </Button>
      </form>
    </Form>
  );
}