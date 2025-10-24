// /home/mark/Music/my-nextjs-project-clean/components/seller/product-form/PreviewCard.tsx
import { useTranslations } from 'next-intl';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { State } from '@/lib/types';

interface PreviewCardProps {
  state: State;
}

export default function PreviewCard({ state }: PreviewCardProps) {
  const t = useTranslations('Seller.ProductForm');

  return (
    <Card>
      <CardHeader>
        <h2>{t('preview')}</h2>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold">{state.formValues.name || t('productNamePlaceholder')}</h3>
          <p className="text-sm text-muted-foreground mb-2">
            {state.formValues.description || t('descriptionPlaceholder')}
          </p>
          {state.images.length > 0 ? (
            <Image
              src={state.images[0]}
              alt={t('productImage')}
              width={200}
              height={200}
              className="object-cover rounded-lg mb-2"
            />
          ) : (
            <div className="w-[200px] h-[200px] bg-gray-200 rounded-lg flex items-center justify-center mb-2">
              <span className="text-muted-foreground">{t('noImage')}</span>
            </div>
          )}
          <p className="font-semibold">
            {t('price')}: {state.currency} {state.formValues.listPrice?.toFixed(2) || '0.00'}
          </p>
          {state.formValues.pricing?.discount?.value && (
            <p className="text-sm text-green-600">
              {t('discount')}: {state.formValues.pricing.discount.type === 'percentage'
                ? `${state.formValues.pricing.discount.value}%`
                : `${state.currency} ${state.formValues.pricing.discount.value}`}
            </p>
          )}
          <p className="text-sm">{t('category')}: {state.formValues.category || t('noCategory')}</p>
          <p className="text-sm">{t('stock')}: {state.formValues.countInStock || 0}</p>
        </div>
      </CardContent>
    </Card>
  );
}