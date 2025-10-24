import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import ProductDetails from '@/components/shared/product/ProductDetails';

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

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'product' });

  const productResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/products?slug=${slug}&action=getProductBySlug`);
  const productData = await productResponse.json();

  if (!productData.success || !productData.data) {
    await sendLog('error', t('Product not found'), { slug });
    return {
      title: t('Product not found'),
      description: 'The product you are looking for is not available.',
      keywords: 'ecommerce, shopping',
      openGraph: {
        title: t('Product not found'),
        description: 'The product you are looking for is not available.',
        images: [],
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/${locale}/seller/product/${slug}`,
      },
      twitter: {
        card: 'summary_large_image',
        title: t('Product not found'),
        description: 'The product you are looking for is not available.',
        images: [],
      },
    };
  }

  const product = productData.data;
  await sendLog('info', t('Product metadata fetched'), { slug });

  return {
    title: `${product.name} | MGZon`,
    description: product.description || `Buy ${product.name} at the best price on MGZon`,
    keywords: `${product.name}, ${product.category}, ${product.brand || ''}, ecommerce, shopping, deals`,
    openGraph: {
      title: product.name,
      description: product.description,
      images: product.images[0] ? [{ url: product.images[0], alt: product.name }] : [],
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/${locale}/seller/product/${product.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.description,
      images: product.images[0] ? [product.images[0]] : [],
    },
  };
}

interface ProductDetailsProps {
  params: Promise<{ slug: string; locale: string }>;
}

export default async function ProductPage({ params }: ProductDetailsProps) {
  const { slug, locale } = await params;
  const t = await getTranslations('product');
  const session = await auth();
  const requestId = crypto.randomUUID();

  // جلب بيانات المنتج عبر API
  const productResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/products?slug=${slug}&action=getProductBySlug`);
  const productData = await productResponse.json();

  if (!productData.success || !productData.data) {
    await sendLog('error', t('Product not found'), { requestId, slug });
    notFound();
  }
  const product = productData.data;

  // جلب بيانات البائع عبر API
  const sellerResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/seller?productSlug=${slug}`);
  const sellerData = await sellerResponse.json();

  if (!sellerData.success || !sellerData.data) {
    await sendLog('error', t('Seller not found'), { requestId, slug });
    notFound();
  }
  const seller = sellerData.data;

  await sendLog('info', t('Product page data fetched successfully'), { requestId, slug });

  return (
    <ProductDetails
      product={product}
      seller={seller}
      locale={locale}
      urlPath={`${locale}/seller/product/${product.slug}`}
    />
  );
}