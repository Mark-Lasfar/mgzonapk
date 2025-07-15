// /app/api/seller/[id]/domain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assignDomain } from '@/lib/domainManager';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storeName, plan } = await req.json();
    await connectToDatabase();
    const store = await Store.findOne({ sellerId: params.id, isActive: true });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const domain = await assignDomain(store.storeId, storeName, plan);
    return NextResponse.json({ domain });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}