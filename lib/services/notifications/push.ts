import * as webPush from 'web-push'
import { connectToDatabase } from '@/lib/db'
import User from '@/lib/db/models/user.model'

webPush.setVapidDetails(
  'mailto:support@mgzon.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export class PushNotificationService {
  async subscribe(userId: string, subscription: PushSubscription) {
    await connectToDatabase()

    await User.findByIdAndUpdate(userId, {
      $push: { pushSubscriptions: subscription },
    })

    return { success: true }
  }

  async unsubscribe(userId: string, endpoint: string) {
    await connectToDatabase()

    await User.findByIdAndUpdate(userId, {
      $pull: { pushSubscriptions: { endpoint } },
    })

    return { success: true }
  }

  async sendNotification(
    subscription: PushSubscription,
    notification: {
      title: string
      body: string
      icon?: string
      badge?: string
      data?: any
    }
  ) {
    try {
      await webPush.sendNotification(
        subscription,
        JSON.stringify({
          notification,
        })
      )
      return { success: true }
    } catch (error) {
      if (error.statusCode === 410) {
        // Subscription has expired or is no longer valid
        return { success: false, expired: true }
      }
      throw error
    }
  }

  async notifyUser(userId: string, notification: {
    title: string
    body: string
    icon?: string
    badge?: string
    data?: any
  }) {
    await connectToDatabase()

    const user = await User.findById(userId)
    if (!user?.pushSubscriptions?.length) return

    const results = await Promise.all(
      user.pushSubscriptions.map(async (subscription) => {
        try {
          await this.sendNotification(subscription, notification)
          return { success: true, subscription }
        } catch (error) {
          return { success: false, subscription, error }
        }
      })
    )

    // Remove expired subscriptions
    const expiredSubscriptions = results
      .filter((result) => !result.success && result.error?.statusCode === 410)
      .map((result) => result.subscription)

    if (expiredSubscriptions.length) {
      await User.findByIdAndUpdate(userId, {
        $pull: {
          pushSubscriptions: {
            endpoint: { $in: expiredSubscriptions.map((s) => s.endpoint) },
          },
        },
      })
    }

    return { success: true }
  }
}

export const pushNotificationService = new PushNotificationService()