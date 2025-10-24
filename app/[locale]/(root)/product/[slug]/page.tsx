import { auth } from '@/auth';
import AddToCart from '@/components/shared/product/add-to-cart';
import { Card, CardContent } from '@/components/ui/card';
import ReviewList from './review-list';
import { generateId, round2 } from '@/lib/utils';
import SelectVariant from '@/components/shared/product/select-variant';
import ProductPrice from '@/components/shared/product/product-price';
import ProductGallery from '@/components/shared/product/product-gallery';
import AddToBrowsingHistory from '@/components/shared/product/add-to-browsing-history';
import { Separator } from '@/components/ui/separator';
import BrowsingHistoryList from '@/components/shared/browsing-history-list';
import RatingSummary from '@/components/shared/product/rating-summary';
import ProductSlider from '@/components/shared/product/product-slider';
import { getTranslations } from 'next-intl/server';
import { getSetting } from '@/lib/actions/setting.actions';

async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, meta }),
    });
  } catch (err) {
    console.error('Failed to send log:', err);
  }
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getTranslations();
  const params = await props.params;
  const settings = await getSetting();

  const productResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/products?slug=${params.slug}&action=getProductBySlug`);
  const productData = await productResponse.json();

  if (!productData.success || !productData.data) {
    await sendLog('error', t('Product.Product not found'), { slug: params.slug });
    return {
      title: t('Product.Product not found'),
      description: settings.seo?.metaDescription || 'The product you are looking for is not available.',
      keywords: settings.seo?.keywords || 'ecommerce, shopping',
      openGraph: {
        title: t('Product.Product not found'),
        description: settings.seo?.metaDescription || 'The product you are looking for is not available.',
        images: [{ url: `${process.env.NEXT_PUBLIC_BASE_URL}/icons/og-image.jpg`, alt: 'MGZon' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: t('Product.Product not found'),
        description: settings.seo?.metaDescription || 'The product you are looking for is not available.',
        images: [`${process.env.NEXT_PUBLIC_BASE_URL}/icons/og-image.jpg`],
      },
    };
  }

  const product = productData.data;
  await sendLog('info', t('Product metadata fetched'), { slug: params.slug });

  return {
    title: `${product.name} | ${settings.site?.name || 'MGZon'}`,
    description: product.description || settings.seo?.metaDescription || `Buy ${product.name} at the best price on MGZon`,
    keywords: `${product.name}, ${product.category}, ${product.brand || ''}, ${product.tags.join(', ')}, ${settings.seo?.keywords || 'ecommerce, shopping, deals'}`,
    openGraph: {
      title: product.name,
      description: product.description || settings.seo?.metaDescription,
      images: product.images[0] ? [{ url: product.images[0], alt: product.name }] : [{ url: settings.seo?.ogImage || '/icons/og-image.jpg', alt: product.name }],
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/${params.locale}/product/${product.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description || settings.seo?.metaDescription,
      images: product.images[0] ? [product.images[0]] : [settings.seo?.ogImage || '/icons/og-image.jpg'],
    },
  };
}

export default async function ProductDetails(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page: string; color: string; size: string }>;
}) {
  const searchParams = await props.searchParams;
  const { page, color, size } = searchParams;
  const params = await props.params;
  const { slug } = params;
  const session = await auth();
  const t = await getTranslations();

  // جلب المنتج عبر API
  const productResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/products?slug=${slug}&action=getProductBySlug`);
  const productData = await productResponse.json();

  if (!productData.success || !productData.data) {
    await sendLog('error', t('Product.Product not found'), { slug });
    return (
      <div className="text-center py-10">
        <h2 className="text-xl font-bold">{t('Product.Product not found')}</h2>
      </div>
    );
  }

  const product = productData.data;

  // جلب المنتجات المرتبطة عبر API
  const relatedProductsResponse = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/products?category=${product.category}&productId=${product._id}&page=${page || '1'}&action=getRelatedProductsByCategory`
  );
  const relatedProductsData = await relatedProductsResponse.json();
  const relatedProducts = relatedProductsData.success ? relatedProductsData.data : { data: [], totalPages: 0 };

  await sendLog('info', t('Product details fetched'), { slug, category: product.category, page });

  // Set default color and size with validation
  const defaultColor = product.colors.length > 0 ? product.colors[0].name : '';
  const defaultSize = product.sizes.length > 0 ? product.sizes[0] : '';

  return (
    <div>
      <AddToBrowsingHistory id={product._id} category={product.category} />
      <section>
        <div className="grid grid-cols-1 md:grid-cols-5">
          <div className="col-span-2">
            <ProductGallery images={product.images} />
          </div>

          <div className="flex w-full flex-col gap-2 md:p-5 col-span-2">
            <div className="flex flex-col gap-3">
              <p className="p-medium-16 rounded-full bg-grey-500/10 text-grey-500">
                {t('Product.Brand')} {product.brand} {product.category}
              </p>
              <h1 className="font-bold text-lg lg:text-xl">{product.name}</h1>

              <RatingSummary
                avgRating={product.avgRating}
                numReviews={product.numReviews}
                asPopover
                ratingDistribution={product.ratingDistribution}
              />
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex gap-3">
                  <ProductPrice
                    price={product.price}
                    listPrice={product.listPrice}
                    isDeal={product.tags.includes('todays-deal')}
                    forListing={false}
                  />
                </div>
              </div>
            </div>
            <div>
              <SelectVariant
                product={product}
                size={size || defaultSize}
                color={color || defaultColor}
              />
            </div>
            <Separator className="my-2" />
            <div className="flex flex-col gap-2">
              <p className="p-bold-20 text-grey-600">
                {t('Product.Description')}:
              </p>
              <p className="p-medium-16 lg:p-regular-18">
                {product.description}
              </p>
            </div>
          </div>
          <div>
            <Card>
              <CardContent className="p-4 flex flex-col gap-4">
                <ProductPrice price={product.price} />

                {product.countInStock > 0 && product.countInStock <= 3 && (
                  <div className="text-destructive font-bold">
                    {t('Product.Only X left in stock - order soon', {
                      count: product.countInStock,
                    })}
                  </div>
                )}
                {product.countInStock !== 0 ? (
                  <div className="text-green-700 text-xl">
                    {t('Product.In Stock')}
                  </div>
                ) : (
                  <div className="text-destructive text-xl">
                    {t('Product.Out of Stock')}
                  </div>
                )}

                {product.countInStock !== 0 && (
                  <div className="flex justify-center items-center">
                    <AddToCart
                      item={{
                        clientId: generateId(),
                        product: product._id,
                        countInStock: product.countInStock,
                        name: product.name,
                        slug: product.slug,
                        category: product.category,
                        price: round2(product.price),
                        quantity: 1,
                        image: product.images[0],
                        size: size || product.sizes[0],
                        color: color || product.colors[0],
                      }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      <section className="mt-10">
        <h2 className="h2-bold mb-2" id="reviews" aria-label={t('Product Customer Reviews')}>
          {t('Product Customer Reviews')}
        </h2>
        <ReviewList product={product} userId={session?.user.id} />
      </section>
      <section className="mt-10">
        <ProductSlider
          products={relatedProducts.data}
          title={t('Product.Best Sellers in', { name: product.category })}
        />
      </section>
      <section>
        <BrowsingHistoryList className="mt-10" />
      </section>
    </div>
  );
}