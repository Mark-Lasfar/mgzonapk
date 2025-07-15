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
import { createOrder } from '@/lib/actions/order.actions';
// import { getFulfillmentService } from '@/lib/api/services/fulfillment';
import { auth } from '@/auth';
import { FulfillmentService } from '@/lib/api/services/fulfillment';

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
  const session = await auth();

  const sellerResponse = await getSellerByCustomSiteUrl(customSiteUrl, locale);
  if (!sellerResponse.success || !sellerResponse.data) {
    notFound();
  }
  const seller = sellerResponse.data;

  let product;
  try {
    product = await getProductBySlug(slug);
  } catch (error) {
    notFound();
  }

  if (product.sellerId.toString() !== seller._id.toString()) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts({
    category: product.category,
    productId: product._id,
    limit: 4,
  });

  const visitorId = crypto.randomUUID();
  await recordVisit(visitorId, seller._id.toString(), '', '', '');

  async function handleAddToCart(formData: FormData) {
    'use server';
    if (!session?.user) {
      return { error: t('loginRequired') };
    }

    const color = formData.get('color') as string;
    const size = formData.get('size') as string;
    const quantity = parseInt(formData.get('quantity') as string) || 1;

    const order = await createOrder({
      userId: session.user.id,
      sellerId: seller._id.toString(),
      items: [{
        productId: product._id.toString(),
        name: product.name,
        slug: product.slug,
        image: product.images[0],
        price: product.pricing.finalPrice,
        quantity,
        color,
        size,
      }],
      paymentMethod: 'stripe',
      itemsPrice: product.pricing.finalPrice * quantity,
    });

    if (!order.success) {
      return { error: t('orderFailed') };
    }

    const fulfillmentService = FulfillmentService(product.warehouseData[0]?.provider || 'shipbob');
    await fulfillmentService.createFulfillmentOrder({
      orderId: order.data._id,
      items: [{
        sku: product.warehouseData[0]?.sku,
        quantity,
      }],
      shippingAddress: {
        name: session.user.name,
        street: session.user.address?.street || '',
        city: session.user.address?.city || '',
        state: session.user.address?.state || '',
        country: session.user.address?.country || '',
        postalCode: session.user.address?.postalCode || '',
        phone: session.user.phone || '',
      },
      shippingMethod: 'standard',
    });

    return { success: true, orderId: order.data._id };
  }

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
                  <button
                    key={color.name}
                    name="color"
                    value={color.name}
                    className={`flex items-center space-x-2 px-3 py-1 border rounded ${!color.inStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!color.inStock}
                    formAction={handleAddToCart}
                  >
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color.hex || color.name }}
                    />
                    <span>{color.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.sizes.length > 0 && (
            <div>
              <span className="font-semibold">{t('sizes')}:</span>
              <div className="flex space-x-2 mt-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    name="size"
                    value={size}
                    className="px-3 py-1 border rounded"
                    formAction={handleAddToCart}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form action={handleAddToCart}>
            <input type="number" name="quantity" defaultValue={1} min={1} className="w-16 p-2 border rounded" />
            <AddToCart item={product} />
          </form>

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

      <ProductReviews
        productId={product._id}
        reviews={product.reviews || []}
        avgRating={product.metrics?.rating || 0}
      />
    </div>
  );
}