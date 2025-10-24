// /app/api/seller/domain/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { assignDomain } from '@/lib/domainManager';
import Store from '@/lib/db/models/store.model';
import { z } from 'zod';

const DomainSchema = z.object({
  storeName: z.string().min(1, 'Store name is required'),
  plan: z.enum(['Trial', 'Basic', 'Pro', 'VIP']),
  customDomain: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    const validatedData = DomainSchema.parse(data);

    await connectToDatabase();
    const store = await Store.findOne({ storeId: session.user.storeId });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const domain = await assignDomain(session.user.storeId, validatedData.storeName, validatedData.plan, validatedData.customDomain);
    return NextResponse.json({ domain });
  } catch (error) {
    const errorMessage = error instanceof z.ZodError ? error.errors.map((e) => e.message).join(', ') : (error as Error).message;
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}