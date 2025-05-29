// app/[locale]/(root)/seller/product/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getProductBySlug } from '@/lib/actions/product.actions';
import { getSellerById } from '@/lib/actions/seller.actions';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AddToCart from '@/components/shared/product/add-to-cart';
import ProductPrice from '@/components/shared/product/product-price';
import Rating from '@/components/shared/product/rating';
import { formatNumber } from '@/lib/utils';

export const metadata = {
  title: 'Product Details',
};

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();

  const seller = await getSellerById(product.sellerId);
  if (!seller) notFound();

  const session = await auth();
  const isSubscribed = seller.subscription.status === 'active' && ['Pro', 'VIP'].includes(seller.subscription.plan);

  return (
    <main className="max-w-6xl mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {isSubscribed && seller.logo && (
              <Image
                src={seller.logo}
                alt={`${seller.businessName} logo`}
                width={80}
                height={80}
                className="object-contain"
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
              fill
              className="object-contain"
            />
          </div>
          <div className="space-y-4">
            <p className="text-lg">{product.description}</p>
            <div className="flex items-center gap-2">
              <Rating rating={product.avgRating} />
              <span>({formatNumber(product.numReviews)} reviews)</span>
            </div>
            <ProductPrice
              price={product.price}
              listPrice={product.listPrice}
              isDeal={product.tags?.includes('todays-deal')}
            />
            <p>Stock: {product.countInStock > 0 ? `${product.countInStock} available` : 'Out of stock'}</p>
            <p>Category: {product.category}</p>
            <p>Seller: <Link href={`/seller/${seller._id}`}>{seller.businessName}</Link></p>
            {product.countInStock > 0 && (
              <AddToCart
                item={{
                  clientId: product._id,
                  product: product._id,
                  name: product.name,
                  slug: product.slug,
                  category: product.category,
                  price: product.price,
                  quantity: 1,
                  image: product.images[0] || '/images/fallback.jpg',
                  countInStock: product.countInStock,
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}