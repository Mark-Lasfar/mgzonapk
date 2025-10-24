// /app/api/stores/[storeId]/domain/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { verifyDomain } from '@/lib/domainManager';

export async function POST(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.storeId || session.user.storeId !== params.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { customDomain } = await req.json();
    const isVerified = await verifyDomain(customDomain);
    if (!isVerified) {
      return NextResponse.json({ error: 'Domain verification failed' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Domain verified' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}