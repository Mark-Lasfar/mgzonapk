import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Seller from '@/lib/db/models/seller.model';
import { connectToDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id }).select('pointsBalance pointsHistory');
    if (!seller) {
      return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        pointsBalance: seller.pointsBalance,
        pointsHistory: seller.pointsHistory,
      },
    });
  } catch (error) {
    console.error('Fetch balance error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}