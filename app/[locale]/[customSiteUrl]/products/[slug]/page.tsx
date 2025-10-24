import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import ProductDetails from '@/components/shared/product/ProductDetails';
import ProductReviews from './components/ProductReviews';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import Link from 'next/link';
import { getSetting } from '@/lib/actions/setting.actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import crypto from 'crypto';

type ProductPageProps = {
  params: Promise<{
    locale: string;
    customSiteUrl: string;
    slug: string;
  }>;
};

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

export async function generateMetadata({ params }: { params: Promise<{ locale: string; customSiteUrl: string; slug: string }> }) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'product' });
  const settings = await getSetting();

  const productResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/products?slug=${slug}&action=getProductBySlug`);
  const productData = await productResponse.json();

  if (!productData.success || !productData.data) {
    await sendLog('error', t('Product not found'), { slug });
    return {
      title: t('Product not found'),
      description: settings.seo?.metaDescription || 'The product you are looking for is not available.',
      keywords: settings.seo?.keywords || 'ecommerce, shopping',
      openGraph: {
        title: t('Product not found'),
        description: settings.seo?.metaDescription || 'The product you are looking for is not available.',
        images: [{ url: `${process.env.NEXT_PUBLIC_BASE_URL}/icons/og-image.jpg`, alt: 'MGZon' }],
      },
      twitter: {
        card: 'summary_large_image',
        title: t('Product not found'),
        description: settings.seo?.metaDescription || 'The product you are looking for is not available.',
        images: [`${process.env.NEXT_PUBLIC_BASE_URL}/icons/og-image.jpg`],
      },
    };
  }

  const product = productData.data;
  await sendLog('info', t('Product metadata fetched'), { slug });

  return {
    title: `${product.name} | ${settings.site?.name || 'MGZon'}`,
    description: product.description || settings.seo?.metaDescription || `Buy ${product.name} at the best price on MGZon`,
    keywords: `${product.name}, ${product.category}, ${product.brand || ''}, ${product.tags.join(', ')}, ${settings.seo?.keywords || 'ecommerce, shopping, deals'}`,
    openGraph: {
      title: product.name,
      description: product.description || settings.seo?.metaDescription,
      images: product.images[0] ? [{ url: product.images[0], alt: product.name }] : [{ url: settings.seo?.ogImage || '/icons/og-image.jpg', alt: product.name }],
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/${locale}/${product.customSiteUrl}/products/${product.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description || settings.seo?.metaDescription,
      images: product.images[0] ? [product.images[0]] : [settings.seo?.ogImage || '/icons/og-image.jpg'],
    },
  };
}

export default async function ProductPage(props: ProductPageProps) {
  const { locale, customSiteUrl, slug } = await props.params;
  const t = await getTranslations('product');
  const session = await auth();
  const requestId = crypto.randomUUID();

  // جلب بيانات البائع عبر API
  const sellerResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/seller?customSiteUrl=${customSiteUrl}&locale=${locale}`);
  const sellerData = await sellerResponse.json();

  if (!sellerData.success || !sellerData.data) {
    await sendLog('error', t('Seller not found for customSiteUrl'), { requestId, customSiteUrl });
    notFound();
  }
  const seller = sellerData.data;

  // جلب بيانات المنتج عبر API
  const productResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/products?slug=${slug}&action=getProductBySlug`);
  const productData = await productResponse.json();

  if (!productData.success || !productData.data) {
    await sendLog('error', t('Product not found'), { requestId, slug });
    notFound();
  }
  const product = productData.data;

  if (product.sellerId.toString() !== seller._id.toString()) {
    await sendLog('error', t('Product does not belong to seller'), { requestId, productId: product._id, sellerId: seller._id });
    notFound();
  }

  // جلب المنتجات المرتبطة عبر API
  const relatedProductsResponse = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/products?category=${product.category}&productId=${product._id}&limit=4&action=getRelatedProducts`
  );
  const relatedProductsData = await relatedProductsResponse.json();
  const relatedProducts = relatedProductsData.success ? relatedProductsData.data : [];

  // تسجيل زيارة
  const visitorId = crypto.randomUUID();
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/visit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorId, sellerId: seller._id, page: '', productId: '', customSiteUrl: '' }),
  });

  await sendLog('info', t('Product page data fetched successfully'), { requestId, customSiteUrl, slug });

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
      <ProductDetails
        product={product}
        seller={seller}
        locale={locale}
        urlPath={`${locale}/${customSiteUrl}/products/${product.slug}`}
      />
      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-4">{t('relatedProducts')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((relatedProduct: any) => (
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