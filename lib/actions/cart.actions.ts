'use server';

import { connectToDatabase } from '@/lib/db';
import Cart, { ICart } from '@/lib/db/models/cart.model';
import Product from '@/lib/db/models/product.model';
import { getTranslations } from 'next-intl/server';
import { sendNotification } from './notification.actions';
import mongoose from 'mongoose';

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  image?: string;
  selectedColor?: string;
  selectedSize?: string;
}

export async function addToCart(
  userId: string,
  productId: string,
  quantity: number,
  selectedColor?: string,
  selectedSize?: string,
  locale: string = 'en'
): Promise<{ success: boolean; message?: string; cart?: ICart }> {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'Cart' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error(t('invalid data'));
      }
      if (quantity < 1) {
        throw new Error(t('invalid quantity'));
      }

      const product = await Product.findById(productId).session(session);
      if (!product) {
        throw new Error(t('product not found'));
      }
      if (product.countInStock < quantity) {
        throw new Error(t('insufficient stock'));
      }

      if (selectedColor && !product.colors.some((c: any) => c.name === selectedColor && c.inStock)) {
        throw new Error(t('color not available'));
      }
      if (selectedSize && !product.sizes.some((s: any) => s.name === selectedSize && s.inStock)) {
        throw new Error(t('size not available'));
      }

      let cart = await Cart.findOne({ userId }).session(session);
      if (!cart) {
        cart = new Cart({ userId, items: [] });
      }

      const existingItemIndex = cart.items.findIndex(
        (item) =>
          item.productId === productId &&
          item.selectedColor === (selectedColor || null) &&
          item.selectedSize === (selectedSize || null)
      );
      if (existingItemIndex >= 0) {
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        if (product.countInStock < newQuantity) {
          throw new Error(t('insufficient stock'));
        }
        cart.items[existingItemIndex].quantity = newQuantity;
      } else {
        cart.items.push({
          productId: product._id,
          name: product.name,
          quantity,
          price: product.pricing.finalPrice,
          image: product.images[0],
          selectedColor: selectedColor || undefined,
          selectedSize: selectedSize || undefined,




          
        });
      }

      product.countInStock  -= quantity;
      await product.save({ session });
      await cart.save({ session });

      await session.commitTransaction();

      await sendNotification({
        userId,
        type: 'cart.updated',
        title: t('cart updated title'),
        message: t('cart updated message', { productName: product.name }),
        channels: ['in_app', 'email'],
        data: { productId: product._id, quantity },
      });

      return { success: true, cart };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : t('add to cart failed'),
    };
  }
}

export async function removeFromCart(
  userId: string,
  productId: string,
  selectedColor?: string,
  selectedSize?: string,
  locale: string = 'en'
): Promise<{ success: boolean; message?: string; cart?: ICart }> {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'Cart' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error(t('invalid data'));
      }

      const cart = await Cart.findOne({ userId }).session(session);
      if (!cart) {
        throw new Error(t('cart not found'));
      }

      const itemIndex = cart.items.findIndex(
        (item) =>
          item.productId === productId &&
          item.selectedColor === (selectedColor || null) &&
          item.selectedSize === (selectedSize || null)
      );

      if (itemIndex === -1) {
        throw new Error(t('item not found'));
      }

      const item = cart.items[itemIndex];
      cart.items.splice(itemIndex, 1);

      const product = await Product.findById(productId).session(session);
      if (product) {
        product.countInStock += item.quantity;
        await product.save({ session });
      }

      await cart.save({ session });

      await session.commitTransaction();

      await sendNotification({
        userId,
        type: 'cart.updated',
        title: t('cart updated title'),
        message: t('cart item removed', { productName: item.name }),
        channels: ['in_app'],
        data: { productId },
      });

      return { success: true, cart };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Remove from cart error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : t('remove from cart failed'),
    };
  }
}

export async function updateCartItemQuantity(
  userId: string,
  productId: string,
  quantity: number,
  selectedColor?: string,
  selectedSize?: string,
  locale: string = 'en'
): Promise<{ success: boolean; message?: string; cart?: ICart }> {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'Cart' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
        throw new Error(t('invalid data'));
      }
      if (quantity < 1) {
        throw new Error(t('invalid quantity'));
      }

      const cart = await Cart.findOne({ userId }).session(session);
      if (!cart) {
        throw new Error(t('cart not found'));
      }

      const itemIndex = cart.items.findIndex(
        (item) =>
          item.productId === productId &&
          item.selectedColor === (selectedColor || null) &&
          item.selectedSize === (selectedSize || null)
      );

      if (itemIndex === -1) {
        throw new Error(t('item not found'));
      }

      const item = cart.items[itemIndex];
      const quantityDifference = quantity - item.quantity;

      const product = await Product.findById(productId).session(session);
      if (!product) {
        throw new Error(t('product not found'));
      }
      if (product.countInStock < quantityDifference) {
        throw new Error(t('insufficient stock'));
      }

      cart.items[itemIndex].quantity = quantity;
      product.countInStock -= quantityDifference;

      await product.save({ session });
      await cart.save({ session });

      await session.commitTransaction();

      await sendNotification({
        userId,
        type: 'cart.updated',
        title: t('cart updated title'),
        message: t('cart quantity updated', { productName: item.name, quantity }),
        channels: ['in_app'],
        data: { productId, quantity },
      });

      return { success: true, cart };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Update cart quantity error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : t('update cart failed'),
    };
  }
}

export async function getCart(userId: string, locale: string = 'en'): Promise<{
  success: boolean;
  message?: string;
  cart?: ICart;
}> {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'Cart' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error(t('invalid data'));
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return { success: true, cart: { userId, items: [] } as ICart };
    }

    return { success: true, cart };
  } catch (error) {
    console.error('Get cart error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : t('get cart failed'),
    };
  }
}

export async function clearCart(userId: string, locale: string = 'en'): Promise<{
  success: boolean;
  message?: string;
}> {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'Cart' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error(t('invalid data'));
      }

      const cart = await Cart.findOne({ userId }).session(session);
      if (!cart || cart.items.length === 0) {
        return { success: true, message: t('cart already empty') };
      }

      for (const item of cart.items) {
        const product = await Product.findById(item.productId).session(session);
        if (product) {
          product.countInStock += item.quantity;
          await product.save({ session });
        }
      }

      cart.items = [];
      await cart.save({ session });

      await session.commitTransaction();

      await sendNotification({
        userId,
        type: 'cart.cleared',
        title: t('cart cleared title'),
        message: t('cart cleared message'),
        channels: ['in_app'],
      });

      return { success: true, message: t('cart cleared') };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Clear cart error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : t('clear cart failed'),
    };
  }
}