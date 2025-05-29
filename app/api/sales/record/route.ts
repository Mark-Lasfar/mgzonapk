import { NextRequest, NextResponse } from 'next/server';
import { handleRevenueSharing } from '@/lib/actions/revenue-sharing';
import Partner from '@/lib/db/models/partner.model';
import Product from '@/lib/db/models/product.model';
import User from '@/lib/db/models/user.model';
import { awardPoints } from '@/lib/actions/points.actions';

export async function POST(req: NextRequest) {
  try {
    const { productId, saleAmount, sellerId } = await req.json();

    // Validate inputs
    if (!productId || !saleAmount || !sellerId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify product
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json({ success: false, message: 'Product not found' }, { status: 404 });
    }

    // Verify seller
    const seller = await Partner.findById(sellerId);
    if (!seller) {
      return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
    }

    // Handle revenue sharing
    const revenueDetails = await handleRevenueSharing(productId, saleAmount);

    // Credit seller's balance
    seller.balance += revenueDetails.sellerRevenue;
    await seller.save();

    // Award points to seller
    const user = await User.findOne({ businessProfile: sellerId });
    if (user) {
      await awardPoints(user._id.toString(), 10, `Sale of product ${productId}`);
    }

    return NextResponse.json({ success: true, data: revenueDetails });
  } catch (error: any) {
    console.error('Error processing sale:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}