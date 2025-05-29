import { NextRequest, NextResponse } from 'next/server';
import Product from '@/lib/db/models/product.model';

export async function POST(req: NextRequest) {
  try {
    const { productId, targetPlatform } = await req.json();

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    // Simulate exporting the product
    const exportDetails = {
      productName: product.name,
      targetPlatform,
      exportedAt: new Date(),
    };

    // Log export details
    console.log('Product exported:', exportDetails);

    return NextResponse.json({ success: true, data: exportDetails });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}