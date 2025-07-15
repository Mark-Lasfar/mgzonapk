'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Product {
  _id: string;
  name: string;
  description: string;
  pricing: { finalPrice: number; discount?: number };
  countInStock: number;
  colors: Array<{ name: string; hex?: string; inStock: boolean }>;
  sizes: string[];
  images: string[];
  category: string;
  brand: string;
  warehouseData: Array<{ location: string }>;
  slug: string;
}

interface Seller {
  _id: string;
  businessName: string;
  logo?: string;
}

interface ClientProductPageProps {
  seller: Seller;
  product: Product;
  relatedProducts: Product[];
  locale: string;
  customSiteUrl: string;
}

export default function ClientProductPage({
  seller,
  product,
  relatedProducts,
  locale,
  customSiteUrl,
}: ClientProductPageProps) {
  const t = useTranslations('product');

  return (
    <div className="container py-6">
      <header className="mb-8 text-center">
        {seller.logo && (
          <Image
            src={seller.logo}
            alt={`${seller.businessName} logo`}
            width={80}
            height={80}
            className="mx-auto mb-4 rounded-full"
          />
        )}
        <h1 className="text-xl font-semibold">
          <Link href={`/${locale}/${customSiteUrl}`}>{seller.businessName}</Link>
        </h1>
      </header>

      <Separator className="mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          {product.images[0] && (
            <Image
              src={product.images[0]}
              alt={product.name}
              width={500}
              height={500}
              className="w-full h-auto object-cover rounded-lg"
              priority
            />
          )}
          <div className="grid grid-cols-4 gap-2">
            {product.images.slice(1).map((image: string, index: number) => (
              <Image
                key={index}
                src={image}
                alt={`${product.name} image ${index + 2}`}
                width={100}
                height={100}
                className="w-full h-auto object-cover rounded-lg"
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-semibold text-primary">
              {product.pricing.finalPrice.toFixed(2)} USD
            </span>
            {product.pricing.discount && (
              <Badge variant="secondary">
                {t('discount', { percentage: product.pricing.discount })}
              </Badge>
            )}
          </div>
          <p className="text-gray-600">{product.description}</p>

          <div>
            <span className="font-semibold">{t('availability')}:</span>{' '}
            {product.countInStock > 0 ? (
              <span className="text-green-600">{t('inStock')}</span>
            ) : (
              <span className="text-red-600">{t('outOfStock')}</span>
            )}
          </div>

          {product.colors.length > 0 && (
            <div>
              <span className="font-semibold">{t('colors')}:</span>
              <div className="flex space-x-2 mt-2">
                {product.colors.map((color) => (
                  <Button
                    key={color.name}
                    variant="outline"
                    size="sm"
                    disabled={!color.inStock}
                    className="flex items-center space-x-2"
                  >
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color.hex || color.name }}
                    />
                    <span>{color.name}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {product.sizes.length > 0 && (
            <div>
              <span className="font-semibold">{t('sizes')}:</span>
              <div className="flex space-x-2 mt-2">
                {product.sizes.map((size) => (
                  <Button key={size} variant="outline" size="sm">
                    {size}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <Button
            size="lg"
            className="w-full"
            disabled={product.countInStock === 0}
            onClick={() => alert(t('addToCartMessage'))}
          >
            {t('addToCart')}
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>{t('details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>{t('category')}: {product.category}</li>
                <li>{t('brand')}: {product.brand}</li>
                {product.warehouseData[0]?.location && (
                  <li>{t('warehouseLocation')}: {product.warehouseData[0].location}</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-4">{t('relatedProducts')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((relatedProduct) => (
              <Card key={relatedProduct._id}>
                <CardContent className="p-4">
                  {relatedProduct.images[0] && (
                    <Image
                      src={relatedProduct.images[0]}
                      alt={relatedProduct.name}
                      width={200}
                      height={200}
                      className="w-full h-40 object-cover rounded-lg mb-4"
                    />
                  )}
                  <h3 className="text-lg font-semibold">{relatedProduct.name}</h3>
                  <p className="text-primary font-bold">
                    {relatedProduct.pricing.finalPrice.toFixed(2)} USD
                  </p>
                  <Button asChild variant="outline" className="w-full mt-4">
                    <Link href={`/${locale}/${customSiteUrl}/products/${relatedProduct.slug}`}>
                      {t('viewProduct')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}