// app/api/subscription/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateSellerSubscription } from '@/lib/actions/seller.actions';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { orderId, paymentMethod, paymentId } = await req.json();
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }

    const result = await updateSellerSubscription(
      session.user.id,
      order.subscriptionPlanId,
      0, // Points to redeem (handled separately)
      paymentMethod,
      paymentMethod === 'stripe' ? { stripeSessionId: paymentId } : { paypalOrderId: paymentId }
    );

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.error }, { status: 400 });
    }

    // Mark order as paid
    order.isPaid = true;
    order.paidAt = new Date();
    await order.save();

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Confirm subscription error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}