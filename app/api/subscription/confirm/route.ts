export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { updateSellerSubscription } from '@/lib/actions/seller.actions';
import { auth } from '@/auth';
import Seller from '@/lib/db/models/seller.model';
import Order from '@/lib/db/models/order.model';
import { getTranslations, getLocale } from 'next-intl/server';
import { z } from 'zod';

const confirmSubscriptionSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentMethod: z.enum(['stripe', 'paypal'], {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  paymentId: z.string().min(1, 'Payment ID is required'),
});

export async function POST(req: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'subscriptionConfirm' });

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    await connectToDatabase();


    const body = await req.json();
    const { orderId, paymentMethod, paymentId } = confirmSubscriptionSchema.parse(body);

    // التحقق من معلومات البنك
    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    if (
      !seller.bankInfo ||
      !seller.bankInfo.accountName ||
      !seller.bankInfo.accountNumber ||
      !seller.bankInfo.bankName ||
      !seller.bankInfo.swiftCode ||
      !seller.bankInfo.verified
    ) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.bankInfoRequired'),
        },
        { status: 400 }
      );
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: t('errors.orderNotFound') },
        { status: 404 }
      );
    }

    if (!order.subscriptionPlanId) {
      return NextResponse.json(
        { success: false, message: t('errors.invalidOrder') },
        { status: 400 }
      );
    }

    const result = await updateSellerSubscription(
      session.user.id,
      order.subscriptionPlanId,
      0, // Points to redeem (handled separately)
      paymentMethod,
      paymentMethod === 'stripe' ? { stripeSessionId: paymentId } : { paypalOrderId: paymentId }
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: t('errors.updateFailed', { error: result.error }) },
        { status: 400 }
      );
    }

    // Mark order as paid
    order.isPaid = true;
    order.paidAt = new Date();
    await order.save();

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Confirm subscription error:', error);
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'subscriptionConfirm' });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: t('errors.server') },
      { status: 500 }
    );
  }
}