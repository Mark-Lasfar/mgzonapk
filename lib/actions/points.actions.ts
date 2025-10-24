'use server';

import { connectToDatabase } from '@/lib/db';
import User from '@/lib/db/models/user.model';
import PointsTransaction, { IPointsTransaction } from '@/lib/db/models/points-transaction.model';
import { getSetting } from './setting.actions';
import { round2 } from '../utils';
import { Types } from 'mongoose';

// دالة sendLog لإرسال اللوج إلى /api/log
async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, meta }),
    });
  } catch (err) {
    console.error('Failed to send log:', err);
  }
}

export async function awardPoints(userId: string, amount: number, description: string, orderId?: string) {
  try {
    await connectToDatabase();
    const session = await User.startSession();
    session.startTransaction();
    try {
      const objectId = new Types.ObjectId(userId);
      const user = await User.findById(objectId).session(session);
      if (!user) {
        await sendLog('error', `User not found for userId: ${userId}`, { userId });
        throw new Error('User not found');
      }
      user.pointsBalance += amount;
      await user.save({ session });
      await PointsTransaction.create(
        [{
          userId: objectId,
          amount,
          type: 'earn',
          description,
          orderId: orderId ? new Types.ObjectId(orderId) : undefined,
        }],
        { session }
      );
      await session.commitTransaction();
      await sendLog('info', 'Points awarded successfully', { userId, amount, orderId });
      return { success: true, message: 'Points awarded successfully' };
    } catch (error) {
      await session.abortTransaction();
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      await sendLog('error', 'Error in awardPoints', { userId, error: errorMessage });
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    await sendLog('error', 'Outer error in awardPoints', { userId, error: errorMessage });
    return { success: false, message: errorMessage };
  }
}

export async function redeemPoints(userId: string, amount: number, currency: string, description: string) {
  try {
    await connectToDatabase();
    const session = await User.startSession();
    session.startTransaction();
    try {
      const objectId = new Types.ObjectId(userId);
      const user = await User.findById(objectId).session(session);
      if (!user) {
        await sendLog('error', `User not found for userId: ${userId}`, { userId });
        throw new Error('User not found');
      }
      if (user.pointsBalance < amount) {
        await sendLog('error', `Insufficient points for userId: ${userId}`, {
          userId,
          balance: user.pointsBalance,
          requested: amount,
        });
        throw new Error('Insufficient points');
      }
      const settings = await getSetting();
      const exchangeRates = settings.availableCurrencies.reduce(
        (acc: { [key: string]: number }, curr) => {
          acc[curr.code] = curr.convertRate;
          return acc;
        },
        {}
      );
      const pointsValue = getPointsValue(currency, exchangeRates);
      const discount = round2(amount * pointsValue);
      user.pointsBalance -= amount;
      await user.save({ session });
      await PointsTransaction.create(
        [{
          userId: objectId,
          amount,
          type: 'redeem',
          description,
        }],
        { session }
      );
      await session.commitTransaction();
      await sendLog('info', 'Points redeemed successfully', { userId, amount, discount, currency });
      return discount;
    } catch (error) {
      await session.abortTransaction();
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      await sendLog('error', 'Error in redeemPoints', { userId, error: errorMessage });
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    await sendLog('error', 'Outer error in redeemPoints', { userId, error: errorMessage });
    return { success: false, message: errorMessage };
  }
}

export async function getPointsBalance(userId: string): Promise<number> {
  try {
    await connectToDatabase();
    const objectId = new Types.ObjectId(userId);
    const user = await User.findById(objectId);
    if (!user) {
      await sendLog('error', `User not found for userId: ${userId}`, { userId });
      throw new Error('User not found');
    }
    await sendLog('info', 'Points balance fetched', { userId, balance: user.pointsBalance });
    return user.pointsBalance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    await sendLog('error', 'Error in getPointsBalance', { userId, error: errorMessage });
    throw error;
  }
}

export async function getPointsHistory(userId: string): Promise<IPointsTransaction[]> {
  try {
    await connectToDatabase();
    const objectId = new Types.ObjectId(userId);
    const transactions = await PointsTransaction.find({ userId: objectId }).sort({ createdAt: -1 });
    await sendLog('info', 'Points history fetched', { userId, transactionCount: transactions.length });
    return JSON.parse(JSON.stringify(transactions));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    await sendLog('error', 'Error in getPointsHistory', { userId, error: errorMessage });
    throw error;
  }
}

function getPointsValue(currency: string, exchangeRates: { [key: string]: number }): number {
  const baseValue = 0.05; // 1 point = $0.05 USD
  const rate = exchangeRates[currency] || 1; // Default to USD
  return baseValue / rate; // Adjust for currency
}

function formatError(error: any): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred';
}