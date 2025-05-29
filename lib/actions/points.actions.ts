'use server';

import { connectToDatabase } from '../db';
import User from '../db/models/user.model';
import PointsTransaction, { IPointsTransaction } from '../db/models/points-transaction.model';
import { getSetting } from './setting.actions';
import { round2 } from '../utils';
import { Types } from 'mongoose';

export async function awardPoints(userId: string, amount: number, description: string, orderId?: string) {
  try {
    await connectToDatabase();
    const session = await User.startSession();
    session.startTransaction();
    try {
      // تحويل userId لـ ObjectId
      const objectId = new Types.ObjectId(userId);
      const user = await User.findById(objectId).session(session);
      if (!user) {
        console.error(`User not found for userId: ${userId}`);
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
      return { success: true, message: 'Points awarded successfully' };
    } catch (error) {
      await session.abortTransaction();
      console.error('Error in awardPoints:', error);
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Outer error in awardPoints:', error);
    return { success: false, message: formatError(error) };
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
        console.error(`User not found for userId: ${userId}`);
        throw new Error('User not found');
      }
      if (user.pointsBalance < amount) {
        console.error(`Insufficient points for userId: ${userId}, balance: ${user.pointsBalance}, requested: ${amount}`);
        throw new Error('Insufficient points');
      }
      const settings = await getSetting();
      const exchangeRates = settings.availableCurrencies.reduce(
        (acc: { [key: string]: number }, curr: { currency: string; rate: number }) => {
          acc[curr.currency] = curr.rate;
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
      return discount;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error in redeemPoints:', error);
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Outer error in redeemPoints:', error);
    return { success: false, message: formatError(error) };
  }
}

export async function getPointsBalance(userId: string): Promise<number> {
  try {
    await connectToDatabase();
    const objectId = new Types.ObjectId(userId);
    const user = await User.findById(objectId);
    if (!user) {
      console.error(`User not found for userId: ${userId}`);
      throw new Error('User not found');
    }
    return user.pointsBalance;
  } catch (error) {
    console.error('Error in getPointsBalance:', error);
    throw error;
  }
}

export async function getPointsHistory(userId: string): Promise<IPointsTransaction[]> {
  try {
    await connectToDatabase();
    const objectId = new Types.ObjectId(userId);
    const transactions = await PointsTransaction.find({ userId: objectId }).sort({ createdAt: -1 });
    return JSON.parse(JSON.stringify(transactions));
  } catch (error) {
    console.error('Error in getPointsHistory:', error);
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