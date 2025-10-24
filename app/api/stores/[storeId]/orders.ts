// /pages/api/stores/[storeId]/orders.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { getTranslations } from 'next-intl/server';
import { Order } from '@/lib/db/models/order.model';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const t = await getTranslations('orders');
  const { storeId } = req.query;
  const session = await auth();

  if (!session?.user?.storeId || session.user.storeId !== storeId) {
    return res.status(401).json({ error: t('unauthorized') });
  }

  await connectToDatabase();

  if (req.method === 'GET') {
    try {
      const orders = await Order.find({ sellerId: storeId }).lean();
      return res.json({ success: true, data: orders });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : t('server_error') });
    }
  }

  if (req.method === 'POST') {
    try {
      const { items, totalPrice, currency, customerId } = req.body;
      const order = new Order({
        sellerId: storeId,
        items,
        totalPrice,
        currency: currency || 'USD',
        status: 'pending',
        paymentStatus: 'pending',
        customerId,
        createdAt: new Date(),
      });
      await order.save();

      // إرسال ويب هوك
      const integration = await Integration.findOne({ type: 'marketplace', enabledBySellers: storeId });
      if (integration) {
        const sellerIntegration = await SellerIntegration.findOne({
          sellerId: storeId,
          integrationId: integration._id,
        });
        if (sellerIntegration?.webhook?.enabled) {
          await WebhookDispatcher.dispatch(storeId, 'order.created', {
            orderId: order._id,
            items,
            totalPrice,
            currency,
          });
        }
      }

      return res.json({ success: true, data: order });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : t('server_error') });
    }
  }

  return res.status(405).json({ error: t('method_not_allowed') });
}