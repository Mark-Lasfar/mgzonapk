import Stripe from 'stripe';
import paypal from '@paypal/checkout-server-sdk';
import SubscriptionOrder from '@/lib/db/models/subscription-order.model';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const paypalClient = new paypal.core.PayPalHttpClient(
  new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID || '',
    process.env.PAYPAL_CLIENT_SECRET || ''
  )
);

interface PaymentSessionParams {
  userId: string;
  planId: string;
  amount: number;
  currency: string;
  method: 'stripe' | 'paypal';
}

export async function createPaymentSession({
  userId,
  planId,
  amount,
  currency,
  method,
}: PaymentSessionParams): Promise<string> {
  await connectToDatabase();

  try {
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new Error('Seller not found');
    }
    if (!seller.bankInfo.verified) {
      throw new Error('Bank information not verified');
    }

    const order = await SubscriptionOrder.create({
      userId,
      planId,
      amount,
      currency,
      paymentMethod: method,
      isPaid: false,
    });

    if (method === 'stripe') {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: `Subscription Plan ${planId}`,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${order._id}/stripe-payment-success`,
        cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/account/subscriptions`,
        metadata: {
          userId,
          planId,
          orderId: order._id.toString(),
        },
      });

      return session.url!;
    } else if (method === 'paypal') {
      const request = new paypal.orders.OrdersCreateRequest();
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
            description: `Subscription Plan ${planId}`,
            custom_id: order._id.toString(),
          },
        ],
      });

      const response = await paypalClient.execute(request);
      const paypalOrderId = response.result.id;

      await SubscriptionOrder.findByIdAndUpdate(order._id, { paymentResult: { id: paypalOrderId } });

      return `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/${order._id}`;
    } else {
      throw new Error('Invalid payment method');
    }
  } catch (error) {
    console.error('Create payment session error:', error);
    throw error;
  }
}