import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getProductBySlug } from '@/lib/actions/product.actions';
import { getSellerById } from '@/lib/actions/seller.actions';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AddToCart from '@/components/shared/product/add-to-cart';
import ProductPrice from '@/components/shared/product/product-price';
// import Rating from '@/components/shared/rating';
import { formatNumber } from '@/lib/utils';
import { IProduct } from '@/lib/db/models/product.model';
import { ISeller } from '@/lib/db/models/seller.model';
import { getTranslations } from 'next-intl/server';
import Rating from '@/components/shared/product/rating';

export const metadata = {
  title: 'Product Details',
};

interface ProductDetailsProps {
  params: { slug: string; locale: string };
}

export default async function ProductPage({ params }: ProductDetailsProps) {
  const t = await getTranslations('product');
  const [productResult, sellerResult, session] = await Promise.all([
    getProductBySlug(params.slug),
    getSellerById(params.slug),
    auth(),
  ]);

  if (!productResult || !sellerResult.success || !sellerResult.data) {
    notFound();
  }

  const product: IProduct = productResult;
  const seller: ISeller = sellerResult.data;
  const isSubscribed = seller.subscription.status === 'active' && ['Pro', 'VIP'].includes(seller.subscription.plan);

  return (
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
              {t('stock')}:{' '}
              {product.countInStock > 0
                ? t('available', { count: product.countInStock })
                : t('outOfStock')}
            </p>
            <p>{t('category')}: {product.category}</p>
            <p>
              {t('seller')}:{' '}
              <Link
                href={`/seller/${seller._id}`}
                className="text-primary hover:underline"
                aria-label={t('viewSeller', { seller: seller.businessName })}
              >
                {seller.businessName}
              </Link>
            </p>
            {product.countInStock > 0 && (
              <AddToCart
                item={{
                  _id: product._id.toString(),
                  name: product.name,
                  pricing: {
                    finalPrice: product.price, // Using product.price as finalPrice
                  },
                  countInStock: product.countInStock,
                  clientId: product._id.toString(),
                  product: product._id.toString(),
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
                  })),
                  sizes: product.sizes.map((s) => ({
                    name: s,
                    inStock: true,
                    quantity: 1,
                  })),
                  warehouseData: product.warehouseData,
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}