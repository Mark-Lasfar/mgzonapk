import { NextRequest, NextResponse } from 'next/server';
import Seller from '@/lib/db/models/seller.model';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id }).select('metrics.totalRevenue pointsBalance pointsHistory');
    if (!seller) {
      return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalEarnings: seller.metrics.totalRevenue,
        balance: seller.pointsBalance,
        transactions: seller.pointsHistory,
      },
    });
  } catch (error) {
    console.error('Fetch earnings error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}