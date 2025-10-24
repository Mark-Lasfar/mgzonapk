// /app/api/stores/[storeId]/domains/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';

export async function GET(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.storeId || session.user.storeId !== params.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const store = await Store.findOne({ storeId: params.storeId }).select('domains');
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, domains: store.domains || [] });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}