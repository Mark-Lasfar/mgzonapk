import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getOrderById } from '@/lib/actions/order.actions';
import PaymentForm from './payment-form';
import Stripe from 'stripe';
import mongoose from 'mongoose';

export const metadata = {
  title: 'Payment',
};

export default async function CheckoutPaymentPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;

  if (!mongoose.isValidObjectId(id)) {
    notFound();
  }

  const order = await getOrderById(id);
  if (!order) {
    notFound();
  }

  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/sign-in`);
  }

  let client_secret = null;
  if (order.paymentMethod === 'Stripe' && !order.isPaid) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2024-09-30.acacia',
    });
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalPrice * 100),
      currency: 'USD',
      metadata: { orderId: order._id.toString() },
    });
    client_secret = paymentIntent.client_secret;
  }

  return (
    <PaymentForm
      order={order}
      paypalClientId={process.env.PAYPAL_CLIENT_ID || 'sb'}
      clientSecret={client_secret}
      isAdmin={session.user.role === 'Admin'}
    />
  );
}