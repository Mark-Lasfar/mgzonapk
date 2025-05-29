import { connectToDatabase } from '@/lib/db'
import Seller from '@/lib/db/models/seller.model'
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher'

export async function checkSubscriptions() {
  try {
    await connectToDatabase()

    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    const expiringSoon = await Seller.find({
      'subscription.status': 'active',
      'subscription.endDate': { $lte: threeDaysFromNow, $gte: now },
    })

    const expired = await Seller.find({
      'subscription.status': 'active',
      'subscription.endDate': { $lt: now },
    })

    for (const seller of expiringSoon) {
      await WebhookDispatcher.dispatch(
        seller.userId.toString(),
        'subscription_expiring',
        {
          title: 'Your Subscription is Expiring Soon',
          message: `Your ${seller.subscription.plan} subscription will expire on ${seller.subscription.endDate.toLocaleDateString()}. Renew now to avoid suspension.`,
          data: {
            plan: seller.subscription.plan,
            expiryDate: seller.subscription.endDate,
          },
          channels: ['email', 'webhook'],
          priority: 'high',
        }
      )
    }

    for (const seller of expired) {
      seller.subscription.status = 'suspended'
      await seller.save()

      await WebhookDispatcher.dispatch(
        seller.userId.toString(),
        'subscription_expired',
        {
          title: 'Your Subscription Has Expired',
          message: `Your ${seller.subscription.plan} subscription has expired. Your seller account is now suspended. Renew your subscription to reactivate.`,
          data: {
            plan: seller.subscription.plan,
            expiryDate: seller.subscription.endDate,
          },
          channels: ['email', 'webhook'],
          priority: 'critical',
        }
      )
    }

    console.log(`Subscription check completed: ${expiringSoon.length} expiring soon, ${expired.length} expired`)
  } catch (error) {
    console.error('Subscription check error:', error)
  }
}

export async function checkSubscription(sellerId: string): Promise<boolean> {
  try {
    await connectToDatabase()
    const seller = await Seller.findById(sellerId)
    if (!seller) {
      return false
    }
    return seller.subscription.status === 'active' && seller.subscription.endDate > new Date()
  } catch (error) {
    console.error('Error checking subscription:', error)
    return false
  }
}