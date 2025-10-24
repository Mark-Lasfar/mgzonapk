'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AddToCart from '@/components/shared/product/add-to-cart';
import ProductPrice from '@/components/shared/product/product-price';
import Rating from '@/components/shared/product/rating';
import { formatNumber } from '@/lib/utils';
import { IProduct } from '@/lib/db/models/product.model';
import { ISeller } from '@/lib/db/models/seller.model';
import { useTranslations } from 'next-intl';
import JsonLd from '@/components/json-ld';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/toast';

interface ProductDetailsProps {
  product: IProduct;
  seller: ISeller;
  locale: string;
  urlPath: string;
}

export default function ProductDetails({ product, seller, locale, urlPath }: ProductDetailsProps) {
  const t = useTranslations('product');
  const { data: session } = useSession();
  const { toast } = useToast();
  const isSubscribed = seller.subscription.status === 'active' && ['Pro', 'VIP'].includes(seller.subscription.plan);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://hager-zon.vercel.app';

  return (
    <div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          image: product.images,
          description: product.description,
          sku: product.warehouseData[0]?.sku || (product._id?.toString() ?? ''),
          brand: { '@type': 'Brand', name: product.brand || 'Unknown' },
          offers: {
            '@type': 'Offer',
            priceCurrency: 'USD',
            price: product.price.toFixed(2),
            itemCondition: 'https://schema.org/NewCondition',
            availability: product.countInStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: `${baseUrl}/${urlPath}`,
          },
          aggregateRating: product.numReviews > 0 ? {
            '@type': 'AggregateRating',
            ratingValue: product.avgRating.toFixed(1),
            reviewCount: product.numReviews,
          } : undefined,
        }}
      />
      <main className="max-w-3xl mx-auto py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              {isSubscribed && seller.logo && (
                <Image
                  src={seller.logo}
                  alt={`${seller.businessName} logo`}
                  width={80}
                  height={80}
                  className="object-contain rounded-lg"
                />
              )}
              <CardTitle>{product.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-6">
            <div className="relative h-96">
              <Image
                src={product.images[0] || '/images/fallback.jpg'}
                alt={product.name}
                fill={true}
                className="object-contain"
                priority
              />
            </div>
            <div className="space-y-4">
              <p className="text-lg">{product.description}</p>
              <div className="flex items-center gap-2">
                <Rating rating={product.avgRating} />
                <span>({formatNumber(product.numReviews)} {t('reviews')})</span>
              </div>
              <ProductPrice
                price={product.price}
                listPrice={product.listPrice}
                isDeal={product.tags?.includes('todays-deal')}
              />
              <p>
                {t('stock')}: {product.countInStock > 0 ? t('available', { count: product.countInStock }) : t('outOfStock')}
              </p>
              <p>{t('category')}: {product.category}</p>
              <p>
                {t('seller')}: <Link href={`/seller/${seller._id}`} className="text-primary hover:underline">{seller.businessName}</Link>
              </p>
              {product.countInStock > 0 && (
                <AddToCart
                  item={{
                    _id: product._id?.toString() ?? '',
                    name: product.name,
                    pricing: { finalPrice: product.price },
                    countInStock: product.countInStock,
                    clientId: product._id?.toString() ?? '',
                    product: product._id?.toString() ?? '',
                    slug: product.slug,
                    category: product.category,
                    price: product.price,
                    quantity: 1,
                    image: product.images[0] || '/images/fallback.jpg',
                    brand: product.brand,
                    sellerName: seller.businessName,
                    colors: product.colors?.map((color) => ({
                      name: color.name,
                      hex: color.hex,
                      inStock: color.inStock,
                      quantity: color.quantity,
                    })) || [],
                    sizes: product.sizes?.map((s) => ({
                      name: s,
                      inStock: true,
                      quantity: 1,
                    })) || [],
                    warehouseData: product.warehouseData,
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}