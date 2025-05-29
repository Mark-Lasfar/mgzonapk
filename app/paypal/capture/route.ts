import { NextRequest, NextResponse } from 'next/server'
import { paypal } from '@/lib/paypal'
import Order from '@/lib/db/models/order.model'

export async function POST(req: NextRequest) {
  const { orderId, internalOrderId } = await req.json() // orderId = PayPal Order ID

  try {
    // Capture payment from PayPal
    const result = await paypal.capturePayment(orderId)

    if (result.status === 'COMPLETED') {
      // Mark order as paid in your DB
      const order = await Order.findById(internalOrderId)
      if (!order) {
        return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 })
      }
      order.isPaid = true
      order.paidAt = new Date()
      order.paymentResult = {
        id: result.id,
        status: result.status,
        payer: result.payer?.email_address || '',
      }
      await order.save()
      return NextResponse.json({ success: true, message: 'Payment completed', data: result })
    } else {
      return NextResponse.json({ success: false, message: 'Payment not completed', data: result }, { status: 400 })
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, message: 'PayPal Capture failed', error: err.message }, { status: 400 })
  }
}