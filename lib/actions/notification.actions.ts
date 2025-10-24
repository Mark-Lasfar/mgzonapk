'use server';

import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import { TFunction } from 'i18next';
import { IProduct } from '@/types';
import { sendNotification } from '@/lib/utils/notification';

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export async function addToCart(
  userId: string,
  product: IProduct,
  quantity: number,
  t: TFunction
): Promise<{ success: boolean; message?: string; cartItem?: CartItem }> {
  try {
    await connectToDatabase();

    if (product.countInStock < quantity) {
      return { success: false, message: t('insufficientStock') };
    }

    const cartItem: CartItem = {
      productId: product._id,
      name: product.name,
      quantity,
      price: product.pricing.finalPrice,
    };

    await sendNotification({
      userId,
      type: 'cart updated',
      title: t('cartUpdatedTitle'),
      message: t('cartUpdatedMessage', { productName: product.name }),
      channels: ['in_app', 'email'],
      data: { productId: product._id, quantity },
      isSellerSpecific: true,
    });

    await Product.findByIdAndUpdate(product._id, {
      $inc: { countInStock: -quantity },
    });

    return { success: true, cartItem };
  } catch (error) {
    console.error('Add to cart error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : t('addToCartFailed'),
    };
  }
}