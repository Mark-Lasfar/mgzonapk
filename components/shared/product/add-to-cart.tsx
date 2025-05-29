'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addToCart } from '@/lib/actions/cart.actions';
import { useToast } from '@/hooks/use-toast';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface AddToCartProps {
  item: {
    _id: string;
    name: string;
    pricing: { finalPrice: number };
    countInStock: number;
    colors?: { name: string; hex: string; inStock: boolean; quantity: number }[];
    sizes?: { name: string; inStock: boolean; quantity: number }[];
    warehouseData?: { provider: string; quantity: number }[];
  };
  minimal?: boolean;
}

export default function AddToCart({ item, minimal = false }: AddToCartProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('cart');
  const locale = useLocale();
  const { data: session } = useSession();
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [availableStock, setAvailableStock] = useState(item.countInStock);

  const isArabic = locale === 'ar';
  const direction = isArabic ? 'rtl' : 'ltr';

  useEffect(() => {
    let stock = item.countInStock;
    if (selectedColor && item.colors) {
      const color = item.colors.find(c => c.name === selectedColor);
      if (color) stock = Math.min(stock, color.quantity);
    }
    if (selectedSize && item.sizes) {
      const size = item.sizes.find(s => s.name === selectedSize);
      if (size) stock = Math.min(stock, size.quantity);
    }
    setAvailableStock(stock);
  }, [selectedColor, selectedSize, item]);

  const handleAddToCart = async (redirectTo: 'cart' | 'checkout' = 'cart') => {
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

    if (quantity > availableStock) {
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
        action: redirectTo === 'cart' ? (
          <Button onClick={() => router.push('/cart')}>{t('goToCart')}</Button>
        ) : undefined,
      });

      router.push(redirectTo === 'cart' ? '/cart' : '/checkout');
    } catch (error) {
      toast({
        variant: 'destructive',
        description: error instanceof Error ? error.message : t('addToCartFailed'),
      });
    } finally {
      setLoading(false);
    }
  };

  return minimal ? (
    <Button
      className="rounded-full w-auto"
      onClick={() => handleAddToCart('cart')}
      disabled={loading || availableStock === 0}
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('adding')}
        </>
      ) : (
        t('addToCart')
      )}
    </Button>
  ) : (
    <div className="w-full space-y-4" style={{ direction }}>
      {item.colors && item.colors.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1">{t('color')}</label>
          <div className="flex gap-2 flex-wrap">
            {item.colors.map((color) => (
              <button
                key={color.name}
                className={`w-8 h-8 rounded-full border-2 ${
                  selectedColor === color.name
                    ? 'border-blue-500'
                    : 'border-gray-300'
                } ${!color.inStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ backgroundColor: color.hex }}
                onClick={() => color.inStock && setSelectedColor(color.name)}
                title={`${color.name} (${color.quantity} ${t('available')})`}
                disabled={!color.inStock}
              />
            ))}
          </div>
          {!selectedColor && item.colors.length > 0 && (
            <p className="text-sm text-red-500 mt-1">{t('selectColor')}</p>
          )}
        </div>
      )}

      {item.sizes && item.sizes.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1">{t('size')}</label>
          <Select
            value={selectedSize || ''}
            onValueChange={setSelectedSize}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('selectSize')} />
            </SelectTrigger>
            <SelectContent>
              {item.sizes.map((size) => (
                <SelectItem
                  key={size.name}
                  value={size.name}
                  disabled={!size.inStock}
                >
                  {size.name} {size.inStock ? `(${size.quantity} ${t('available')})` : t('outOfStock')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedSize && item.sizes.length > 0 && (
            <p className="text-sm text-red-500 mt-1">{t('selectSize')}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">{t('quantity')}</label>
        <Input
          type="number"
          min={1}
          max={availableStock}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Math.min(availableStock, Number(e.target.value))))}
          className="w-24"
          disabled={availableStock === 0}
        />
        {availableStock === 0 && (
          <p className="text-sm text-red-500 mt-1">{t('outOfStock')}</p>
        )}
      </div>

      <div className="flex gap-4">
        <Button
          onClick={() => handleAddToCart('cart')}
          disabled={loading || availableStock === 0}
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('adding')}
            </>
          ) : (
            t('addToCart')
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleAddToCart('checkout')}
          disabled={loading || availableStock === 0}
          className="flex-1"
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
      </div>
    </div>
  );
}