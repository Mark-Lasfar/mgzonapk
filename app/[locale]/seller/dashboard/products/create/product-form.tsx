import { useTranslations } from 'next-intl';
import ProductForm from '@/components/seller/product-form/ProductForm';

export default function CreateProductPage() {
  const t = useTranslations('Seller.ProductForm');

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{t('createProduct')}</h1>
      <ProductForm type="Create" />
    </div>
  );
}