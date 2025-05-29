import { NextRequest, NextResponse } from 'next/server';
import Product from '@/lib/db/models/product.model';

export async function POST(req: NextRequest) {
  try {
    const { productData, sourceSellerId, sourceStoreId } = await req.json();

    // Verify required data
    if (!productData || (!sourceSellerId && !sourceStoreId)) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create a new product in the system
    const newProduct = await Product.create({
      ...productData,
      sourceSellerId,
      sourceStoreId,
    });

    return NextResponse.json({ success: true, data: newProduct });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}