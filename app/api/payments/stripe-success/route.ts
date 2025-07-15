import { NextRequest, NextResponse } from 'next/server';
import { handlePaymentSuccess } from '@/lib/utils/payments';
import mongoose from 'mongoose';
import { getTranslations } from 'next-intl/server';
import Seller from '@/lib/db/models/seller.model';
import Order from '@/lib/db/models/order.model';
import { connectToDatabase } from '@/lib/db';
import { revalidatePath } from 'next/cache';

class PaymentError extends Error {
  constructor(public message: string, public code: string) {
    super(message);
    this.name = 'PaymentError';
    Object.setPrototypeOf(this, PaymentError.prototype);
  }
}

export async function GET(req: NextRequest) {
  let t;
  try {
    t = await getTranslations({ locale: req.nextUrl.searchParams.get('locale') || 'en', namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      throw new PaymentError(t('errors.orderIdRequired'), 'MISSING_ORDER_ID');
    }

    if (!mongoose.isValidObjectId(orderId)) {
      throw new PaymentError(t('errors.invalidOrderId'), 'INVALID_ORDER_ID');
    }

    await connectToDatabase();

    const order = await Order.findById(orderId).populate('sellerId');
    if (!order) {
      throw new PaymentError(t('errors.orderNotFound'), 'ORDER_NOT_FOUND');
    }

    const result = await handlePaymentSuccess(orderId);
    if (!result.success) {
      throw new PaymentError(t('errors.paymentProcessingFailed', { message: result.message || '' }), 'PAYMENT_FAILED');
    }

    // Update seller subscription if payment is for a subscription
    if (result.data?.type === 'subscription') {
      const seller = await Seller.findById(order.sellerId);
      if (!seller) {
        throw new PaymentError(t('errors.sellerNotFound'), 'SELLER_NOT_FOUND');
      }

      const plan = result.data?.plan || 'Premium'; // Default to Premium if not specified
      const planDuration = result.data?.duration || 'monthly'; // Default to monthly
      const endDate = new Date();
      if (planDuration === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (planDuration === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      seller.subscription = {
        plan,
        startDate: new Date(),
        endDate,
        status: 'active',
        features: {
          productsLimit: plan === 'Premium' ? 500 : 50,
          commissionRate: plan === 'Premium' ? 5 : 7,
          prioritySupport: plan === 'Premium',
          instantPayouts: plan === 'Premium',
          customSectionsLimit: plan === 'Premium' ? 5 : 0,
        },
      };

      seller.freeTrial = false;
      seller.freeTrialEndDate = undefined;
      seller.trialMonthsUsed = seller.trialMonthsUsed || 0 + 1;

      await seller.save();
    }

    // Update order status
    order.status = 'completed';
    await order.save();

    revalidatePath('/[locale]/seller/dashboard', 'page');
    revalidatePath('/[locale]/account/subscriptions', 'page');

    // Dynamic redirect based on payment type
    const redirectUrl =
      result.data?.type === 'subscription'
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/account/subscriptions?success=true`
        : `${process.env.NEXT_PUBLIC_BASE_URL}/orders/${orderId}?success=true`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Stripe success error:', error);
    const message = error instanceof PaymentError ? error.message : t('errors.serverError');
    const code = error instanceof PaymentError ? error.code : 'UNKNOWN';
    return NextResponse.json({ success: false, message, code }, { status: error instanceof PaymentError ? 400 : 500 });
  }
}