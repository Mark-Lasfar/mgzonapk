'use client';
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Testimonial {
  id: string;
  name: string;
  quote: string;
  image?: string;
  rating: number;
}

interface TestimonialsSliderProps {
  config: {
    testimonials: Testimonial[];
    primaryColor: string;
  };
}

export default function TestimonialsSlider({ config }: TestimonialsSliderProps) {
  const t = useTranslations('Testimonials');
  const { testimonials, primaryColor } = config;
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (testimonials.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % testimonials.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [testimonials.length]);

  if (!testimonials?.length) {
    return <p className="text-center py-8">{t('noTestimonials')}</p>;
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <div className="container mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: primaryColor || '#333' }}>
        {t('title')}
      </h2>
      <div className="relative">
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col items-center">
              {testimonials[currentIndex].image && (
                <Image
                  src={testimonials[currentIndex].image}
                  alt={testimonials[currentIndex].name}
                  width={80}
                  height={80}
                  className="rounded-full mb-4"
                />
              )}
              <p className="text-lg italic mb-4 text-center">"{testimonials[currentIndex].quote}"</p>
              <p className="font-semibold">{testimonials[currentIndex].name}</p>
              <div className="flex mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-xl ${i < testimonials[currentIndex].rating ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        {testimonials.length > 1 && (
          <>
            <Button
              variant="outline"
              className="absolute top-1/2 left-4 transform -translate-y-1/2"
              onClick={handlePrev}
              style={{ backgroundColor: primaryColor || '#333', color: '#fff' }}
            >
              &lt;
            </Button>
            <Button
              variant="outline"
              className="absolute top-1/2 right-4 transform -translate-y-1/2"
              onClick={handleNext}
              style={{ backgroundColor: primaryColor || '#333', color: '#fff' }}
            >
              &gt;
            </Button>
          </>
        )}
      </div>
    </div>
  );
}