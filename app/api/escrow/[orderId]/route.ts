// /app/api/escrow/[orderId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { releaseEscrow, refundEscrow } from '@/lib/utils/payments';
import { auth } from '@/auth';

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();
    if (action === 'release') {
      const result = await releaseEscrow(params.orderId);
      return NextResponse.json(result);
    } else if (action === 'refund') {
      const result = await refundEscrow(params.orderId);
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to process escrow' }, { status: 500 });
  }
}