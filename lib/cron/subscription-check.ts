import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import SubscriptionPlan from '@/lib/db/models/subscription-plan.model';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import mongoose from 'mongoose';

export async function checkSubscriptions() {
  try {
    await connectToDatabase();

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const expiringSoon = await Seller.find({
      'subscription.status': 'active',
      'subscription.endDate': { $lte: threeDaysFromNow, $gte: now },
    });

    const expired = await Seller.find({
      'subscription.status': 'active',
      'subscription.endDate': { $lt: now },
    });

    for (const seller of expiringSoon) {
      const plan = await SubscriptionPlan.findOne({ _id: seller.subscription.planId });
      const planName = plan ? plan.name : 'Unknown Plan';
      const endDate = seller.subscription.endDate;
      if (!endDate) {
        console.warn(`Skipping webhook for seller ${seller._id}: endDate is undefined`);
        continue;
      }
      await WebhookDispatcher.dispatch(
        seller.userId.toString(),
        'subscription expiring',
        {
          title: 'Your Subscription is Expiring Soon',
          message: `Your ${planName} subscription will expire on ${endDate.toLocaleDateString()}. Renew now to avoid suspension.`,
          data: {
            plan: planName,
            expiryDate: endDate,
          },
          channels: ['email', 'webhook'],
          priority: 'high',
        }
      );
    }

    for (const seller of expired) {
      const plan = await SubscriptionPlan.findOne({ _id: seller.subscription.planId });
      const planName = plan ? plan.name : 'Unknown Plan';
      const endDate = seller.subscription.endDate;
      if (!endDate) {
        console.warn(`Skipping webhook for seller ${seller._id}: endDate is undefined`);
        continue;
      }
      seller.subscription.status = 'suspended';
      await seller.save();

      await WebhookDispatcher.dispatch(
        seller.userId.toString(),
        'subscription expired',
        {
          title: 'Your Subscription Has Expired',
          message: `Your ${planName} subscription has expired. Your seller account is now suspended. Renew your subscription to reactivate.`,
          data: {
            plan: planName,
            expiryDate: endDate,
          },
          channels: ['email', 'webhook'],
          priority: 'critical',
        }
      );
    }

    console.log(`Subscription check completed: ${expiringSoon.length} expiring soon, ${expired.length} expired`);
  } catch (error) {
    console.error('Subscription check error:', error);
  }
}

export async function checkSubscription(sellerId: string): Promise<boolean> {
  try {
    await connectToDatabase();
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return false;
    }
    const endDate = seller.subscription.endDate;
    return seller.subscription.status === 'active' && endDate instanceof Date && endDate > new Date();
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}