'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Star } from 'lucide-react';
import { sendNotification } from '@/lib/utils/notification';
import { useToast } from '@/components/ui/toast';
import { IReview } from '@/lib/db/models/product.model';

const reviewSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().min(10).max(500),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

interface ProductReviewsProps {
  productId: string;
  reviews: IReview[];
  avgRating: number;
  page?: number;
  pageSize?: number;
}

export default function ProductReviews({ productId, reviews, avgRating, page = 1, pageSize = 5 }: ProductReviewsProps) {
  const start = (page - 1) * pageSize;
  const paginatedReviews = reviews.slice(start, start + pageSize);
  const t = useTranslations('product.reviews');
  const { data: session, status } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const locale = useLocale();
  const isArabic = locale === 'ar';
  const direction = isArabic ? 'rtl' : 'ltr';

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 0, comment: '' },
  });

  const onSubmit = async (data: ReviewFormValues) => {
    if (!session?.user?.id) {
      toast({ description: t('loginRequired'), variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/product/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          userId: session.user.id,
          userName: session.user.name || session.user.email,
          rating: data.rating,
          comment: data.comment,
          sendNotification: true,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ description: t('submitSuccess') });
        form.reset();
        setShowForm(false);
        window.location.reload();
      } else {
        throw new Error(result.message || t('submitFailed'));
      }
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : t('submitFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mt-8" style={{ direction }}>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <div className="flex items-center space-x-2">
          <span>{avgRating.toFixed(1)} ⭐</span>
          <span className="text-gray-500">({reviews.length} {t('count')})</span>
        </div>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-gray-500">{t('noReviews')}</p>
        ) : (
          <div className="space-y-4">
            {paginatedReviews.map((review, index) => (
              <div key={index} className="border-b pb-4">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold">{review.name || 'Anonymous'}</span>
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-gray-600 mt-1">{review.comment}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(review.createdAt))}
                </p>
              </div>
            ))}
          </div>
        )}

        {status === 'authenticated' && (
          <div className="mt-6">
            {!showForm ? (
              <Button onClick={() => setShowForm(true)}>{t('writeReview')}</Button>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="rating"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('rating')}</FormLabel>
                        <FormControl>
                          <div className="flex space-x-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-6 w-6 cursor-pointer ${star <= field.value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                                onClick={() => field.onChange(star)}
                              />
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('comment')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder={t('commentPlaceholder')} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex space-x-2">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? t('submitting') : t('submit')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowForm(false)}>
                      {t('cancel')}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}