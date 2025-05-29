import { NextRequest, NextResponse } from 'next/server';
import { getTranslations, getLocale } from 'next-intl/server';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Order from '@/lib/db/models/order.model';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
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

    const { cartId, currency = 'usd' } = await request.json();

    if (!cartId) {
      return NextResponse.json(
        { success: false, message: t('errors.invalidCartId') },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const order = await Order.findOne({ cartId, userId: session.user.id });

    if (!order) {
      return NextResponse.json(
        { success: false, message: t('errors.orderNotFound') },
        { status: 404 }
      );
    }

    const lineItems = order.items.map((item: any) => ({
      price_data: {
        currency,
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const paymentSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${request.headers.get('origin')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.headers.get('origin')}/checkout/cancel`,
      metadata: {
        userId: session.user.id,
        cartId,
        orderId: order._id.toString(),
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: paymentSession.id,
      url: paymentSession.url,
    });
  } catch (error) {
    console.error('Gateway POST error:', error);
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

    if (!sessionId) {
      return NextResponse.json(
        { success: false, message: t('errors.invalidSessionId') },
        { status: 400 }
      );
    }

    const paymentSession = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      success: true,
      status: paymentSession.payment_status,
      orderId: paymentSession.metadata?.orderId,
    });
  } catch (error) {
    console.error('Gateway GET error:', error);
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
      },
      { status: 500 }
    );
  }
}