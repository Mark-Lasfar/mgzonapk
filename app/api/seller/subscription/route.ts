import { NextRequest, NextResponse } from 'next/server';
import { assignDomain } from '@/lib/domainManager';
import { auth } from '@/auth';

import { connectToDatabase } from '@/lib/db';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storeId, plan } = await req.json();
    await connectToDatabase();
    const Store = mongoose.model('Store');
    const store = await Store.findOne({ storeId });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const validPlans = ['trial', 'basic', 'pro'];
    if (!validPlans.includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    await Store.updateOne(
      { storeId },
      { $set: { subscriptionPlan: plan } }
    );
    const domain = await assignDomain(storeId, store.storeName, plan);

    return NextResponse.json({ plan, domain });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}