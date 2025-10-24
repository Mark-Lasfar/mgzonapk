// /app/api/stores/[storeId]/domain/primary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Store from '@/lib/db/models/store.model';

export async function PATCH(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    const session = await auth();
    if (!session?.user?.storeId || session.user.storeId !== params.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { domainName } = await req.json();
    await connectToDatabase();

    const store = await Store.findOne({ storeId: params.storeId });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    store.domains = store.domains.map((d: any) => ({
      ...d,
      isPrimary: d.domainName === domainName,
    }));

    await store.save();
    return NextResponse.json({ success: true, message: 'Primary domain updated' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}