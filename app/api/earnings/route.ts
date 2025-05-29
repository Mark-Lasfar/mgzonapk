import { NextRequest, NextResponse } from 'next/server';
import Partner from '@/lib/db/models/partner.model';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId');

    if (!partnerId) {
      return NextResponse.json({ success: false, message: 'Partner ID is required' }, { status: 400 });
    }

    const partner = await Partner.findById(partnerId);

    if (!partner) {
      return NextResponse.json({ success: false, message: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalEarnings: partner.totalEarnings,
        balance: partner.balance,
        transactions: partner.transactions,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}