// المسار: /home/hager/Trash/my-nextjs-project-master/app/seller/components/product-preview.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ProductReviews from '@/app/[locale]/[customSiteUrl]/products/[slug]/components/ProductReviews';
import { logger } from '@/lib/utils/logger';

export default function ProductPreview({ data, currency = 'USD' }: { data: any; currency?: string }) {
  const t = useTranslations('Seller.ProductPreview');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [countdown, setCountdown] = useState('');

  // تحديث العداد الزمني
  useEffect(() => {
    const updateCountdown = () => {
      const countdownSection = data.sections?.find((s: any) => s.type === 'countdown');
      if (countdownSection?.content.endDate) {
        const endDate = new Date(countdownSection.content.endDate);
        const now = new Date();
        const diff = endDate.getTime() - now.getTime();
        if (diff > 0) {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        } else {
          setCountdown('Expired');
        }
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [data.sections]);

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'desktop' ? 'default' : 'outline'}
            onClick={() => setViewMode('desktop')}
          >
            {t('desktop')}
          </Button>
          <Button
            variant={viewMode === 'mobile' ? 'default' : 'outline'}
            onClick={() => setViewMode('mobile')}
          >
            {t('mobile')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={viewMode === 'mobile' ? 'max-w-[375px] mx-auto' : ''}>
        <div className="space-y-4">
          {data.images?.[0] && (
            <Image
              src={data.images[0]}
              alt={data.name || t('productImage')}
              width={viewMode === 'mobile' ? 300 : 500}
              height={viewMode === 'mobile' ? 300 : 500}
              className="object-cover rounded-lg"
            />
          )}
          <h2 className="text-2xl font-bold">{data.name || t('productName')}</h2>
          <p className="text-gray-600">{data.description || t('noDescription')}</p>
          <p className="text-lg font-semibold">
            {currency} {data.pricing?.finalPrice?.toFixed(2) || '0.00'}
            {data.pricing?.discount?.type !== 'none' && (
              <span className="text-sm text-gray-500 line-through ml-2">
                {currency} {data.listPrice?.toFixed(2) || '0.00'}
              </span>
            )}
          </p>
          {data.sections?.map((section: any, index: number) => (
            <div key={section.id}>
              {section.type === 'text' && <p>{section.content.text}</p>}
              {section.type === 'image' && section.content.url && (
                <Image
                  src={section.content.url}
                  alt={t('sectionImage')}
                  width={viewMode === 'mobile' ? 300 : 500}
                  height={viewMode === 'mobile' ? 300 : 500}
                  className="object-cover rounded-lg"
                />
              )}
              {section.type === 'video' && section.content.url && (
                <video
                  src={section.content.url}
                  controls
                  className={viewMode === 'mobile' ? 'w-full max-w-[300px]' : 'w-full max-w-[500px]'}
                />
              )}
              {section.type === 'button' && section.content.url && (
                <Button asChild>
                  <a href={section.content.url} target="_blank" rel="noopener noreferrer">
                    {section.content.label || t('clickHere')}
                  </a>
                </Button>
              )}
              {section.type === 'carousel' && section.content.images?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {section.content.images.map((img: string, idx: number) => (
                    <Image
                      key={idx}
                      src={img}
                      alt={`${t('carouselImage')} ${idx + 1}`}
                      width={viewMode === 'mobile' ? 150 : 200}
                      height={viewMode === 'mobile' ? 150 : 200}
                      className="object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}
              {section.type === 'countdown' && countdown && (
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className="text-lg font-semibold">{t('countdown')}</p>
                  <p>{countdown}</p>
                </div>
              )}
              {section.type === 'reviews' && data._id && (
                <ProductReviews
                  productId={data._id}
                  reviews={data.reviews || []}
                  avgRating={data.avgRating || 0}
                />
              )}
            </div>
          ))}
          {data.variants?.length > 0 && (
            <div>
              <p className="font-semibold">{t('variants')}</p>
              {data.variants.map((variant: any, index: number) => (
                <p key={index}>
                  {variant.name}: {variant.options.map((opt: any) => opt.name).join(', ')}
                </p>
              ))}
            </div>
          )}
          <Button>{t('addToCart')}</Button>
        </div>
      </CardContent>
    </Card>
  );
}