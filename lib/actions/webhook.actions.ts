'use server'

import { WebhookDispatcher } from '../api/webhook-dispatcher'
import { auth } from '@/auth'

async function getCurrentUserInfo() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return {
    userId: session.user.id,
  }
}

export async function triggerWebhook({
  event,
  payload,
}: {
  event: string
  payload: any
}) {
  try {
    const { userId } = await getCurrentUserInfo()
    await WebhookDispatcher.dispatch(userId, event, {
      ...payload,
      timestamp: new Date().toISOString(),
    })
    console.log(`[${new Date().toISOString()}] Webhook triggered: ${event}`, { userId, payload })
  } catch (error) {
    console.error('Error triggering webhook:', error)
    throw new Error(`Failed to trigger webhook: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}