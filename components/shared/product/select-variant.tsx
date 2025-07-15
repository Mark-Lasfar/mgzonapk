'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { IProduct } from '@/lib/db/models/product.model';
import { useTranslations } from 'next-intl';

interface SelectVariantProps {
  product: IProduct;
  color: string;
  size: string;
}

export default function SelectVariant({ product, color, size }: SelectVariantProps) {
  const t = useTranslations('Product');
  const selectedColor = color || (product.colors.length > 0 ? product.colors[0].name : '');
  const selectedSize = size || (product.sizes.length > 0 ? product.sizes[0] : '');

  return (
    <div className="space-y-4">
      {product.colors.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t('Color')}:</span>
          {product.colors.map((colorOption) => (
            <Button
              key={colorOption.name}
              asChild
              variant="outline"
              className={`flex items-center gap-2 border-2 ${
                selectedColor === colorOption.name ? 'border-primary' : 'border-muted'
              }`}
              aria-label={`${t('Select color')} ${colorOption.name}`}
            >
              <Link
                href={`?${new URLSearchParams({
                  color: colorOption.name,
                  size: selectedSize,
                })}`}
                replace
                scroll={false}
              >
                <span
                  style={{ backgroundColor: colorOption.hex || colorOption.name }}
                  className="h-4 w-4 rounded-full border border-muted-foreground"
                  aria-hidden="true"
                />
                {colorOption.name}
              </Link>
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('No colors available')}</p>
      )}

      {product.sizes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{t('Size')}:</span>
          {product.sizes.map((sizeOption) => (
            <Button
              key={sizeOption}
              asChild
              variant="outline"
              className={`border-2 ${
                selectedSize === sizeOption ? 'border-primary' : 'border-muted'
              }`}
              aria-label={`${t('Select size')} ${sizeOption}`}
            >
              <Link
                href={`?${new URLSearchParams({
                  color: selectedColor,
                  size: sizeOption,
                })}`}
                replace
                scroll={false}
              >
                {sizeOption}
              </Link>
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('No sizes available')}</p>
      )}
    </div>
  );
}