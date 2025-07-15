// /home/hager/Trash/my-nextjs-project-master/app/api/gateway/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getTranslations, getLocale } from 'next-intl/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { Order } from '@/lib/db/models/order.model';
import Seller from '@/lib/db/models/seller.model';
import { PaymentService } from '@/lib/api/services/payment';
import { z } from 'zod';
import { SellerError } from '@/lib/errors/seller-error';

const requestSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  currency: z.string().min(3, 'Invalid currency code').default('USD'),
  provider: z.string().default('mgpay'),
});

export async function POST(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.gateway' });

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cartId, currency, provider } = requestSchema.parse(body);

    await connectToDatabase();
    const order = await Order.findOne({ _id: cartId, user: session.user.id });
    if (!order) {
      return NextResponse.json(
        { success: false, message: t('errors.orderNotFound') },
        { status: 404 }
      );
    }

    const seller = await Seller.findById(order.sellerId);
    if (!seller) {
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    if (seller.checkoutSettings?.customCheckoutEnabled && seller.checkoutSettings?.checkoutPageUrl) {
      return NextResponse.json({
        success: true,
        redirect: true,
        url: seller.checkoutSettings.checkoutPageUrl,
      });
    }

    if (provider === 'mgpay' && seller.subscription.features?.instantPayouts && !seller.bankInfo?.verified) {
      return NextResponse.json(
        { success: false, message: t('errors.bankNotVerified') },
        { status: 403 }
      );
    }

    if (provider === 'Cash On Delivery') {
      await Order.updateOne(
        { _id: cartId },
        { paymentStatus: 'pending', status: 'pending' }
      );
      return NextResponse.json({
        success: true,
        sessionId: cartId,
        url: `${request.headers.get('origin')}/account/orders/${cartId}`,
      });
    }

    const paymentService = await PaymentService.createFromSellerId(seller._id.toString(), provider);
    const paymentResponse = await paymentService.initiatePayment({
      amount: order.totalPrice,
      currency,
      orderId: order._id.toString(),
      customer: {
        email: session.user.email || '',
        name: session.user.name || '',
      },
      metadata: {
        userId: session.user.id,
        cartId,
        orderId: order._id.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: paymentResponse.transactionId,
      url: paymentResponse.paymentUrl || `${request.headers.get('origin')}/checkout/${order._id}`,
    });
  } catch (error) {
    console.error('Gateway POST error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: error.errors,
        },
        { status: 400 }
      );
    }
    if (error instanceof SellerError && error.message === 'CUSTOM_CHECKOUT_REDIRECT') {
      return NextResponse.json({
        success: true,
        redirect: true,
        url: error.data.redirectUrl,
      });
    }
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.gateway' });

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const provider = searchParams.get('provider') || 'mgpay';

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: t('errors.invalidSessionId') },
        { status: 400 }
      );
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const order = await Order.findOne({ user: session.user.id }).sort({ createdAt: -1 });
    if (!order) {
      return NextResponse.json(
        { success: false, message: t('errors.orderNotFound') },
        { status: 404 }
      );
    }

    const seller = await Seller.findById(order.sellerId);
    if (!seller) {
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    if (provider === 'Cash On Delivery') {
      return NextResponse.json({
        success: true,
        status: order.paymentStatus,
        orderId: order._id,
      });
    }

    const paymentService = await PaymentService.createFromSellerId(seller._id.toString(), provider);
    const paymentResponse = await paymentService.verifyPayment(sessionId);

    return NextResponse.json({
      success: true,
      status: paymentResponse.status,
      orderId: paymentResponse.metadata?.orderId,
    });
  } catch (error) {
    console.error('Gateway GET error:', error);
    if (error instanceof SellerError && error.message === 'CUSTOM_CHECKOUT_REDIRECT') {
      return NextResponse.json({
        success: true,
        redirect: true,
        url: error.data.redirectUrl,
      });
    }
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
      },
      { status: 500 }
    );
  }
}