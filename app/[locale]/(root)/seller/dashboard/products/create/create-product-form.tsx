'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ProductForm = dynamic(() => import('./product-form'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>
  ),
});

export default function CreateProductForm() {
  const t = useTranslations('seller.products');
  return (
    <Card className="bg-card rounded-lg shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold">{t('createProduct')}</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <ProductForm type="Create" />
      </CardContent>
    </Card>
  );
}