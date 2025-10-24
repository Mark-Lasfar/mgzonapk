// /home/mark/Music/my-nextjs-project-clean/app/api/stores/[storeId]/domain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { assignDomain } from '@/lib/domainManager';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';

export async function POST(req: NextRequest, { params }: { params: { storeId: string } }) {
  try {
    const session = await auth(); 
    if (!session?.user?.storeId || session.user.storeId !== params.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storeName, plan } = await req.json();
    await connectToDatabase();

    const store = await mongoose.model('Store').findOne({ storeId: params.storeId });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const domain = await assignDomain(params.storeId, storeName, plan);
    return NextResponse.json({ domain });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}