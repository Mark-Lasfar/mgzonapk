import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import mongoose from 'mongoose';

export async function GET(req: Request, { params }: { params: { userId: string } }) {
  try {
    await connectToDatabase();
    const { userId } = params;

    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const seller = await Seller.findOne({ userId });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    return NextResponse.json(seller);
  } catch (err) {
    console.error('Error fetching seller:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}