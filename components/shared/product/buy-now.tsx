'use client';

import { Button } from '@/components/ui/button';
// import { useToast } from '@/hooks/use-toast';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { addToCart } from '@/lib/actions/cart.actions';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useState } from 'react';

interface BuyNowProps {
  item: {
    _id: string;
    name: string;
    pricing: { finalPrice: number };
    countInStock: number;
    colors?: { name: string; hex: string; inStock: boolean; quantity: number }[];
    sizes?: { name: string; inStock: boolean; quantity: number }[];
  };
  selectedColor?: string;
  selectedSize?: string;
  quantity: number;
}

export default function BuyNow({ item, selectedColor, selectedSize, quantity }: BuyNowProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('cart');
  const locale = useLocale();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const isArabic = locale === 'ar';
  const direction = isArabic ? 'rtl' : 'ltr';

  const handleBuyNow = async () => {
    if (!session?.user?.id) {
      toast({
        variant: 'destructive',
        description: t('loginRequired'),
      });
      router.push('/signin');
      return;
    }

    if (item.colors && item.colors.length > 0 && !selectedColor) {
      toast({
        variant: 'destructive',
        description: t('selectColor'),
      });
      return;
    }

    if (item.sizes && item.sizes.length > 0 && !selectedSize) {
      toast({
        variant: 'destructive',
        description: t('selectSize'),
      });
      return;
    }

    if (quantity > item.countInStock) {
      toast({
        variant: 'destructive',
        description: t('insufficientStock'),
      });
      return;
    }

    setLoading(true);
    try {
      const result = await addToCart(
        session.user.id,
        item._id,
        quantity,
        selectedColor,
        selectedSize,
        locale
      );

      if (!result.success) {
        throw new Error(result.message || t('addToCartFailed'));
      }

      toast({
        description: t('cartUpdatedMessage', { productName: item.name }),
      });

      router.push('/checkout');
    } catch (error) {
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : t('buyNowFailed'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="default"
      onClick={handleBuyNow}
      disabled={loading || item.countInStock === 0}
      style={{ direction }}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('processing')}
        </>
      ) : (
        t('buyNow')
      )}
    </Button>
  );
}