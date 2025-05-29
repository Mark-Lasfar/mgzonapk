'use server';

import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getSellerByCustomSiteUrl } from '@/lib/actions/seller.actions';
import { getProductBySlug, getRelatedProducts } from '@/lib/actions/product.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import AddToCart from '@/components/shared/product/add-to-cart';
import ProductReviews from './components/ProductReviews';
import { recordVisit } from '@/lib/actions/visit.actions';

type ProductPageProps = {
  params: Promise<{
    locale: string;
    customSiteUrl: string;
    slug: string;
  }>;
};

export default async function ProductPage(props: ProductPageProps) {
  const { locale, customSiteUrl, slug } = await props.params;
  const t = await getTranslations('product');

  // Fetch seller by customSiteUrl
  const sellerResponse = await getSellerByCustomSiteUrl(customSiteUrl, locale);
  if (!sellerResponse.success || !sellerResponse.data) {
    notFound();
  }
  const seller = sellerResponse.data;

  // Fetch product by slug
  let product;
  try {
    product = await getProductBySlug(slug);
  } catch (error) {
    notFound();
  }

  // Verify product belongs to the seller
  if (product.sellerId.toString() !== seller._id.toString()) {
    notFound();
  }

  // Fetch related products
  const relatedProducts = await getRelatedProducts({
    category: product.category,
    productId: product._id,
    limit: 4,
  });

  // Record visit (assuming visitorId is generated or from session)
  const visitorId = crypto.randomUUID(); // Replace with actual user ID if available
  await recordVisit(visitorId, seller._id.toString(), '', '', '');

  return (
    <div className="container py-6">
      {/* Seller Header */}
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

      {/* Product Details */}
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
          <AddToCart item={product} />

          {/* Product Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  {t('category')}: {product.category}
                </li>
                <li>
                  {t('brand')}: {product.brand}
                </li>
                {product.warehouseData[0]?.location && (
                  <li>
                    {t('warehouseLocation')}: {product.warehouseData[0].location}
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Related Products */}
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
                    {relatedProduct.price.toFixed(2)} USD
                  </p>
                  <Button asChild variant="outline" className="w-full mt-4">
                    <Link
                      href={`/${locale}/${customSiteUrl}/products/${relatedProduct.slug}`}
                    >
                      {t('viewProduct')}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Product Reviews */}
      <ProductReviews
        productId={product._id}
        reviews={product.reviews || []}
        avgRating={product.metrics?.rating || 0}
      />
    </div>
  );
}