'use server';

import { connectToDatabase } from '../db';
import Seller, { ISeller } from '../db/models/seller.model';
import { formatError } from '../utils';

export async function getSubscriptionByUserId(userId: string): Promise<{
  success: boolean;
  data?: ISeller['subscription'];
  message?: string;
}> {
  try {
    await connectToDatabase();
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      return { success: false, message: 'Seller not found' };
    }
    return { success: true, data: seller.subscription };
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

export async function updateSubscription(
  userId: string,
  plan: 'Basic' | 'Pro' | 'VIP',
  features: { productsLimit: number; commission: number; prioritySupport: boolean; instantPayouts: boolean }
): Promise<{ success: boolean; message: string }> {
  try {
    await connectToDatabase();
    const session = await Seller.startSession();
    session.startTransaction();
    try {
      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) throw new Error('Seller not found');
      seller.subscription = {
        plan,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active',
        features,
      };
      await seller.save({ session });
      await session.commitTransaction();
      return { success: true, message: 'Subscription updated successfully' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}

export async function cancelSubscription(userId: string): Promise<{ success: boolean; message: string }> {
  try {
    await connectToDatabase();
    const session = await Seller.startSession();
    session.startTransaction();
    try {
      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) throw new Error('Seller not found');
      seller.subscription.status = 'cancelled';
      seller.subscription.endDate = new Date();
      await seller.save({ session });
      await session.commitTransaction();
      return { success: true, message: 'Subscription cancelled successfully' };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    return { success: false, message: formatError(error) };
  }
}