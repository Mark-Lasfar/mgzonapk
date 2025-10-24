// /home/mark/Music/my-nextjs-project-clean/app/api/webhooks/stripe/route.tsx
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { sendPurchaseReceipt } from '@/emails'
import {Order} from '@/lib/db/models/order.model'
import Seller from '@/lib/db/models/seller.model'
import User from '@/lib/db/models/user.model'
import { logger } from '@/lib/api/services/logging'
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher'
import { sendNotification } from '@/lib/utils/notification'
import { FulfillmentService } from '@/lib/api/services/fulfillment'
// import { sendNotification } from '@/lib/actions/notification.actions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)

const fulfillmentService = new FulfillmentService({
  shipbob: {
    apiKey: process.env.SHIPBOB_API_KEY!,
    apiUrl: process.env.SHIPBOB_API_URL!,
  },
  amazon: {
    region: process.env.AWS_REGION!,
    refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    roleArn: process.env.AWS_ROLE_ARN!,
  },
})

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('stripe-signature') as string

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET as string
      )
    } catch (err) {
      logger.error('Invalid Stripe webhook signature', {
        error: err instanceof Error ? err.message : String(err),
      })
      return new NextResponse('Webhook Error: Invalid signature', { status: 400 })
    }

    if (event.type === 'charge.succeeded') {
      const charge = event.data.object as Stripe.Charge
      const orderId = charge.metadata.orderId
      const email = charge.billing_details.email
      const pricePaidInCents = charge.amount

      const order = await Order.findById(orderId)
        .populate('user', 'email whatsapp')
        .populate('items.product')
        .lean()
      if (!order) {
        logger.error('Order not found', { orderId })
        return new NextResponse('Order not found', { status: 400 })
      }

      if (!order.sellerId || !order.user) {
        logger.error('Invalid order data', { orderId, sellerId: order.sellerId, user: order.user })
        return new NextResponse('Invalid order data', { status: 400 })
      }

      order.isPaid = true
      order.paidAt = new Date()
      order.paymentResult = {
        id: event.id,
        status: 'COMPLETED',
        email_address: email!,
        pricePaid: (pricePaidInCents / 100).toFixed(2),
      }
      await Order.findByIdAndUpdate(orderId, order)

      const seller = await Seller.findById(order.sellerId).lean()
      if (!seller) {
        logger.error('Seller not found', { sellerId: order.sellerId })
        return new NextResponse('Seller not found', { status: 400 })
      }

      const user = await User.findById(order.user._id).select('whatsapp').lean()
      const sellerUser = await User.findById(seller.userId).select('whatsapp').lean()

      const sellerChannels = sellerUser?.whatsapp ? ['email', 'in_app', 'whatsapp'] : ['email', 'in_app']
      const userChannels = user?.whatsapp ? ['email', 'in_app', 'whatsapp'] : ['email', 'in_app']

      await sendNotification({
        userId: seller.userId,
        type: 'order_placed',
        title: `New Order #${order._id}`,
        message: `A new order has been placed for ${order.items.length} items. Total: $${order.totalPrice}`,
        channels: sellerChannels,
        data: { orderId: order._id, totalPrice: order.totalPrice },
      })

      await sendNotification({
        userId: order.user._id,
        type: 'order_placed',
        title: `Order #${order._id} Confirmed`,
        message: `Your order for ${order.items.length} items has been confirmed. Total: $${order.totalPrice}`,
        channels: userChannels,
        data: { orderId: order._id, totalPrice: order.totalPrice },
      })

      const warehouseId = order.items[0]?.product?.warehouseId
      if (warehouseId) {
        await fulfillmentService.processOrder(order._id, {
          fulfillmentType: 'shipbob',
          priority: 'standard',
        })

        await sendNotification({
          userId: warehouseId,
          type: 'order_fulfillment',
          title: `Order #${order._id} Ready for Fulfillment`,
          message: `Please process order with ${order.items.length} items for delivery to ${order.shippingAddress.fullName}.`,
          channels: ['email'],
          data: { orderId: order._id },
        })
      }

      try {
        await sendPurchaseReceipt({ order })
      } catch (err) {
        logger.error('Failed to send purchase receipt email', {
          error: err instanceof Error ? err.message : String(err),
        })
      }

      await WebhookDispatcher.dispatch(order.user._id, 'order.paid', {
        orderId: order._id,
        status: 'paid',
        total: order.totalPrice,
      })

      return NextResponse.json({ message: 'Order processed successfully' })
    }

    return NextResponse.json({ message: 'Event not handled' })
  } catch (error) {
    logger.error('Error handling Stripe webhook', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}