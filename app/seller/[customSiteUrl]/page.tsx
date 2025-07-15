import { notFound } from 'next/navigation';
import { getSellerByCustomSiteUrl } from '@/lib/actions/seller.actions';
import { getProductBySlug, getRelatedProducts } from '@/lib/actions/product.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { customLogger } from '@/lib/api/services/logging';
import { useTranslations } from 'next-intl';
import crypto from 'crypto';

type ProductPageProps = {
  params: Promise<{
    locale: string;
    customSiteUrl: string;
    slug: string;
  }>;
};

type Seller = {
  _id: string;
  businessName: string;
  logo: string;
};

type Product = {
  _id: string;
  name: string;
  description: string;
  pricing: {
    finalPrice: number;
    discount?: number;
  };
  countInStock: number;
  colors: { name: string; hex?: string; inStock: boolean }[];
  sizes: string[];
  images: string[];
  category: string;
  sellerId: string;
  slug: string;
};

async function getProductPageData({ customSiteUrl, slug, locale }: { customSiteUrl: string; slug: string; locale: string }) {
  const requestId = crypto.randomUUID();
  try {
    const sellerResponse = await getSellerByCustomSiteUrl(customSiteUrl, locale);
    if (!sellerResponse.success || !sellerResponse.data) {
      await customLogger.error('Seller not found for customSiteUrl', { requestId, customSiteUrl, service: 'product-page' });
      notFound();
    }
    const seller: Seller = sellerResponse.data;

    let product: Product;
    try {
      product = await getProductBySlug(slug);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to fetch product by slug', { requestId, slug, error: errorMessage, service: 'product-page' });
      notFound();
    }

    if (product.sellerId.toString() !== seller._id.toString()) {
      await customLogger.error('Product does not belong to seller', { requestId, productId: product._id, sellerId: seller._id, service: 'product-page' });
      notFound();
    }

    const relatedProducts = await getRelatedProducts({
      category: product.category,
      productId: product._id,
      limit: 4,
    });

    await customLogger.info('Product page data fetched successfully', { requestId, customSiteUrl, slug, service: 'product-page' });
    return { seller, product, relatedProducts };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Error fetching product page data', { requestId, error: errorMessage, service: 'product-page' });
    throw error;
  }
}

export default async function ProductPage(props: ProductPageProps) {
  const { locale, customSiteUrl, slug } = await props.params;

  const { seller, product, relatedProducts } = await getProductPageData({
    customSiteUrl,
    slug,
    locale,
  });

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

      <ProductDetails product={product} seller={seller} locale={locale} relatedProducts={relatedProducts} />
    </div>
  );
}

function ProductDetails({ product, seller, locale, relatedProducts }: { product: Product; seller: Seller; locale: string; relatedProducts: Product[] }) {
  const t = useTranslations('product');

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Images */}
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
            {product.images.slice(1).map((image, index) => (
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

        {/* Product Info */}
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

          {/* Stock Status */}
          <div>
            <span className="font-semibold">{t('availability')}:</span>{' '}
            {product.countInStock > 0 ? (
              <span className="text-green-600">{t('inStock')}</span>
            ) : (
              <span className="text-red-600">{t('outOfStock')}</span>
            )}
          </div>

          {/* Colors */}
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

          {/* Sizes */}
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

          {/* Add to Cart */}
          <Button
            size="lg"
            className="w-full"
            disabled={product.countInStock === 0}
            onClick={() => {
              alert(t('addToCartMessage'));
            }}
          >
            {t('addToCart')}
          </Button>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-semibold mb-6">{t('relatedProducts')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((relatedProduct) => (
              <Card key={relatedProduct._id}>
                <CardHeader>
                  <Image
                    src={relatedProduct.images[0] || '/placeholder.png'}
                    alt={relatedProduct.name}
                    width={200}
                    height={200}
                    className="w-full h-auto object-cover rounded-t-lg"
                  />
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-lg">{relatedProduct.name}</CardTitle>
                  <p className="text-primary font-semibold">
                    {relatedProduct.pricing.finalPrice.toFixed(2)} USD
                  </p>
                  <Link href={`/${locale}/${seller.businessName}/${relatedProduct.slug}`}>
                    <Button variant="outline" size="sm" className="mt-2">
                      {t('viewProduct')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}