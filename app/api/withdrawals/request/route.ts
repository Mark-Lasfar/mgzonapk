import { NextRequest, NextResponse } from 'next/server';
import WithdrawalRequest from '@/lib/db/models/withdrawal-request.model';
import Seller from '@/lib/db/models/seller.model';
import { connectToDatabase } from '@/lib/db';
import { z } from 'zod';

const requestSchema = z.object({
  sellerId: z.string().min(1, 'Seller ID is required'),
  amount: z.number().min(0, 'Amount cannot be negative'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedData = requestSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid request data', errors: parsedData.error.errors },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const { sellerId, amount } = parsedData.data;

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return NextResponse.json(
        { success: false, message: 'Seller not found' },
        { status: 404 }
      );
    }

    if (seller.pointsBalance < amount) {
      return NextResponse.json(
        { success: false, message: 'Insufficient points balance' },
        { status: 400 }
      );
    }

    const withdrawal = await WithdrawalRequest.create({ sellerId, amount });
    return NextResponse.json({ success: true, data: withdrawal });
  } catch (error) {
    console.error('Create withdrawal error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}