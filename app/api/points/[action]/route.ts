import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPointsBalance, redeemPoints } from '@/lib/actions/points.actions';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop(); // Extract action from URL

    if (action === 'balance') {
      const balance = await getPointsBalance(session.user.id);
      return NextResponse.json({ success: true, data: balance });
    }
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Points GET error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop(); // Extract action from URL

    if (action === 'apply') {
      const { points, currency } = await req.json();
      if (!points || !currency) {
        return NextResponse.json({ success: false, message: 'Missing points or currency' }, { status: 400 });
      }
      const discount = await redeemPoints(session.user.id, points, currency, 'Points redemption at checkout');
      if (typeof discount === 'number') {
        return NextResponse.json({ success: true, data: { discount } });
      }
      return NextResponse.json(discount, { status: 400 });
    }
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Points POST error:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}