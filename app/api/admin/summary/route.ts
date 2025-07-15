import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getOrderSummary } from '@/lib/actions/order.actions';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { date } = await req.json();
    if (!date?.from || !date?.to) {
      return NextResponse.json({ success: false, message: 'Invalid date range' }, { status: 400 });
    }

    const summary = await getOrderSummary({
      from: new Date(date.from),
      to: new Date(date.to),
    });
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch summary' }, { status: 500 });
  }
}