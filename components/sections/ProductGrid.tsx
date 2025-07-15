'use client';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface ProductGridProps {
  config: {
    products: Array<{
      id: string;
      name: string;
      price: number;
      image: string;
      slug: string;
      currency: string;
      availability: 'in_stock' | 'out_of_stock';
    }>;
    primaryColor: string;
    layout: 'grid' | 'list';
  };
}

export default function ProductGrid({ config }: ProductGridProps) {
  const t = useTranslations('ProductGrid');
  const { products, primaryColor, layout } = config;

  if (!products?.length) {
    return <p className="text-center py-8">{t('noProducts')}</p>;
  }

  return (
    <div className="container mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6" style={{ color: primaryColor || '#333' }}>
        {t('title')}
      </h2>
      <div
        className={`grid gap-6 ${
          layout === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'
        }`}
      >
        {products.map((product) => (
          <Link key={product.id} href={`/products/${product.slug}`} className="block">
            <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
              <Image
                src={product.image || '/default-product.jpg'}
                alt={product.name}
                width={300}
                height={300}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="text-lg font-semibold">{product.name}</h3>
                <p className="text-gray-600">
                  {product.price.toLocaleString()} {product.currency}
                </p>
                <Badge
                  variant={product.availability === 'in_stock' ? 'default' : 'destructive'}
                  className="mt-2"
                >
                  {t(product.availability === 'in_stock' ? 'InStock' : 'OutOfStock')}
                </Badge>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}