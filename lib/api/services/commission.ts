import Order from '@/lib/db/models/order.model';
import { connectToDatabase } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' });

export class CommissionService {
  async processCommission(orderId: string, commissionRate: number = 0.1) {
    try {
      await connectToDatabase();
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      const commissionAmount = order.itemsPrice * commissionRate;
      const sellerAmount = order.itemsPrice - commissionAmount;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.itemsPrice * 100), // Convert to cents
        currency: 'usd',
        metadata: { orderId, sellerId: order.sellerId },
      });

      await Order.findByIdAndUpdate(orderId, {
        commission: commissionAmount,
        sellerAmount,
        paymentStatus: 'pending',
        paymentIntentId: paymentIntent.id,
      });

      // Transfer to seller's balance (implement seller payout logic here)
      return { success: true, data: { commissionAmount, sellerAmount } };
    } catch (error) {
      console.error('Commission processing error:', error);
      return { success: false, error: 'Failed to process commission' };
    }
  }
}