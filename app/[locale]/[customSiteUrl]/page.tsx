// app/[locale]/[customSiteUrl]/page.tsx

import { notFound } from 'next/navigation';
import { getSellerByCustomSiteUrl } from '@/lib/actions/seller.actions';
import { getProductBySlug, getRelatedProducts } from '@/lib/actions/product.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTranslations } from 'next-intl'; // لا تستخدم هنا في الصفحة الرئيسية مباشرة

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

async function getProductPageData({ customSiteUrl, slug, locale }: { customSiteUrl: string, slug: string, locale: string }) {
  // جلب بيانات البائع والمنتج
  const sellerResponse = await getSellerByCustomSiteUrl(customSiteUrl, locale);
  if (!sellerResponse.success || !sellerResponse.data) {
    notFound();
  }
  const seller: Seller = sellerResponse.data;

  let product: Product;
  try {
    product = await getProductBySlug(slug);
  } catch (error) {
    notFound();
  }

  // تحقق أن المنتج ينتمي للبائع
  if (product.sellerId.toString() !== seller._id.toString()) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts({
    category: product.category,
    productId: product._id,
    limit: 4,
  });

  return { seller, product, relatedProducts };
}

export default async function ProductPage(props: ProductPageProps) {
  const { locale, customSiteUrl, slug } = await props.params;

  // جلب البيانات
  const { seller, product, relatedProducts } = await getProductPageData({
    customSiteUrl,
    slug,
    locale
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

      {/* قم بتمرير البيانات إلى مكون لعرض الترجمة */}
      <ProductDetails product={product} seller={seller} locale={locale} relatedProducts={relatedProducts} />
    </div>
  );
}

// مكون منفصل لعرض تفاصيل المنتج
function ProductDetails({ product, seller, locale, relatedProducts }: { product: Product, seller: Seller, locale: string, relatedProducts: Product[] }) {
  const t = useTranslations('product');  // استخدم الترجمة هنا في المكون الفرعي
  
  return (
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
            // Placeholder for add-to-cart logic
            alert(t('addToCartMessage'));
          }}
        >
          {t('addToCart')}
        </Button>
      </div>
    </div>
  );
}
