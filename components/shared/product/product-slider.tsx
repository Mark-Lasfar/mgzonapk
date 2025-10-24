// /components/shared/product/product-slider.tsx
'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import ProductCard from './product-card';
import { IProduct } from '@/lib/db/models/product.model';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

interface ProductSliderProps {
  title?: string;
  products: IProduct[];
  hideDetails?: boolean;
  onItemClick?: (product: IProduct) => void;
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const t = useTranslations('Home');
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date(endTime);
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft(t('Expired'));
        clearInterval(timer);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [endTime, t]);

  return <span className="text-red-500 text-sm font-semibold">{timeLeft}</span>;
}

export default function ProductSlider({
  title,
  products,
  hideDetails = false,
  onItemClick,
}: ProductSliderProps) {
  const t = useTranslations('Home');

  const handleItemClick = (product: IProduct) => {
    onItemClick?.(product);
    toast.success(t('AddedToCart', { name: product.name }));
  };

  return (
    <div className="w-full bg-background">
      {title && <h2 className="text-2xl font-bold mb-5 text-gray-900 dark:text-white">{t(title)}</h2>}
      <Carousel
        opts={{
          align: 'start',
        }}
        className="w-full"
      >
        <CarouselContent>
          {products.map((product, index) => (
            <CarouselItem
              key={product.slug}
              className={
                hideDetails
                  ? 'md:basis-1/4 lg:basis-1/6'
                  : 'md:basis-1/3 lg:basis-1/5'
              }
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => handleItemClick(product)}
              >
                <ProductCard
                  hideDetails={hideDetails}
                  hideAddToCart
                  hideBorder
                  product={product}
                />
                {product.tags?.includes('flash-sale') && product.offerEndTime && (
                  <div className="mt-2 text-center">
                    <CountdownTimer endTime={product.offerEndTime} />
                  </div>
                )}
              </motion.div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-0" />
        <CarouselNext className="right-0" />
      </Carousel>
    </div>
  );
}