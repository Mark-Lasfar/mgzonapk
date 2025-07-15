import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id }).select('settings');
    if (!seller) {
      return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: seller });
  } catch (error) {
    console.error('Error fetching seller:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch seller' }, { status: 500 });
  }
}