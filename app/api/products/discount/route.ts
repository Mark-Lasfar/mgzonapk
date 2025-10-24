// /app/api/products/discount/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { applyDiscount } from '@/lib/actions/product.actions';
import { getSellerByUserId } from '@/lib/actions/seller.actions';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sellerResponse = await getSellerByUserId(session.user.id);
    if (!sellerResponse.success || !sellerResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Seller account required' },
        { status: 403 }
      );
    }

    const { storeId, discountCode } = await req.json();
    const result = await applyDiscount({ storeId, discountCode });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Apply discount error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to apply discount',
      },
      { status: 500 }
    );
  }
}