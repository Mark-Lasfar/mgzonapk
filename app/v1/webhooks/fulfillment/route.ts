import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { logger } from '@/lib/api/services/logging'
import { UnifiedFulfillmentService } from '@/lib/api/services/unified-fulfillment'
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher'

function verifySignature(payload: any, signature: string | null, provider: string): boolean {
  const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`]
  if (!signature || !secret) return false

  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(JSON.stringify(payload)).digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex')
  const provider = request.headers.get('x-fulfillment-provider')
  const signature = request.headers.get(`x-${provider}-signature`)

  try {
    const payload = await request.json()

    if (!provider || !verifySignature(payload, signature, provider)) {
      logger.warn('Invalid webhook signature', { requestId, provider })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    logger.info('Received webhook', {
      requestId,
      provider,
      eventType: payload.eventType,
      orderId: payload.orderId,
    })

    const fulfillmentService = new UnifiedFulfillmentService([])
    const result = await fulfillmentService.handleProviderWebhook(provider, payload)

    await WebhookDispatcher.dispatch(payload.userId, `${provider}.order.updated`, result)

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Webhook processing error', {
      requestId,
      provider,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Webhook processing failed',
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}