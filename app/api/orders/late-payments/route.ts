// /home/mark/Music/my-nextjs-project-clean/app/api/orders/late-payments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { Order } from '@/lib/db/models/order.model';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import Seller from '@/lib/db/models/seller.model';

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      customLogger.warn('Unauthorized_access', { requestId });
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      customLogger.warn('Seller_not_found', { requestId, userId: session.user.id });
      return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
    }

    const latePayments = await Order.find({
      sellerId: seller._id,
      status: 'pending_payment',
      createdAt: { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // متأخرة أكثر من 7 أيام
    }).select('id productId status createdAt amount currency');

    customLogger.info('Fetched_late_payments', {
      requestId,
      sellerId: seller._id,
      count: latePayments.length,
    });

    return NextResponse.json({
      success: true,
      data: latePayments,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Server error';
    customLogger.error('Failed_to_fetch_late_payments', { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}