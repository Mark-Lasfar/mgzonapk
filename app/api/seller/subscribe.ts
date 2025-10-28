import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import Setting from '@/lib/db/models/setting.model';
import { getSession } from 'next-auth/react';
import { customLogger } from '@/lib/api/services/logging';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
});

export async function POST(req: Request) {
  try {
    const session = await getSession({ req });
    if (!session || !session.user?.id) {
      customLogger.error('Unauthorized access attempt', { service: 'subscribe' });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { sellerId } = await req.json();
    if (!sellerId || sellerId !== session.user.id) {
      customLogger.error('Invalid or unauthorized sellerId', { service: 'subscribe', sellerId });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      customLogger.error('Seller not found', { service: 'subscribe', sellerId });
      return NextResponse.json({ message: 'Seller not found' }, { status: 404 });
    }

    // استرجاع إعدادات الشات بوت
    const settings = await Setting.findOne();
    if (!settings || !settings.aiAssistant.enabled) {
      customLogger.error('AI Assistant is disabled or settings not found', { service: 'subscribe', sellerId });
      return NextResponse.json({ message: 'AI Assistant is disabled' }, { status: 400 });
    }

    let customerId = seller.stripeAccountId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: seller.email });
      customerId = customer.id;
      seller.stripeAccountId = customerId;
    }

    // إنشاء منتج وسعر في Stripe ديناميكيًا
    const product = await stripe.products.create({
      name: 'AI Assistant Premium Subscription',
      description: settings.aiAssistant.description,
      images: [settings.aiAssistant.image],
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(settings.aiAssistant.price * 100), // السعر بالسنت
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    seller.aiAssistant = {
      uses: 0,
      limit: null,
      status: 'premium',
      subscriptionStart: new Date(),
      subscriptionEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    };

    await seller.save();

    customLogger.info('Subscription created successfully', { service: 'subscribe', sellerId, subscriptionId: subscription.id });

    return NextResponse.json({
      clientSecret: (subscription.latest_invoice as any).payment_intent.client_secret,
      subscriptionId: subscription.id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    customLogger.error('Failed to create subscription', { service: 'subscribe', error: errorMessage });
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
}