import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Seller from '@/lib/db/models/seller.model';
import {Order} from '@/lib/db/models/order.model';
import { connectToDatabase } from '@/lib/db';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      customLogger.warn('Unauthorized_access', { requestId });
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { productId, purchasePrice, commissionRate, supplierId } = await req.json();
    if (!productId || !purchasePrice || !commissionRate || !supplierId) {
      customLogger.warn('Missing_required_fields', { requestId, productId, purchasePrice, commissionRate, supplierId });
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
    }

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      customLogger.warn('Seller_not_found', { requestId, userId: session.user.id });
      return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
    }

    const totalDeduction = purchasePrice + (purchasePrice * commissionRate);
    if (seller.pointsBalance < totalDeduction) {
      customLogger.warn('Insufficient_balance', { requestId, userId: session.user.id, totalDeduction });
      return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 });
    }

    const order = await Order.create({
      sellerId: seller._id,
      productId,
      status: 'pending_supply',
      purchasePrice,
      commission: purchasePrice * commissionRate,
      supplierId,
      createdAt: new Date(),
    });

    seller.pointsBalance -= totalDeduction;
    seller.pointsHistory.push({
      amount: totalDeduction,
      type: 'debit',
      reason: `Order placed for product ${productId}`,
      createdAt: new Date(),
    });
    await seller.save();

    customLogger.info('Order_placed_successfully', { requestId, orderId: order._id, productId, supplierId });
    return NextResponse.json({ success: true, message: 'Order placed successfully', data: order });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Server error';
    customLogger.error('Failed_to_place_order', { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}