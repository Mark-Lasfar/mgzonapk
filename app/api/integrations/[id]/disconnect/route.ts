import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');
    const result = await SellerIntegration.updateOne(
      { sellerId: session.user.id, integrationId: params.id, sandbox },
      {
        isActive: false,
        status: 'disconnected',
        lastUpdated: new Date(),
        $push: { history: { event: 'disconnected', date: new Date() } },
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    logger.info('Integration disconnected', { requestId, integrationId: params.id, sandbox });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to disconnect integration', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}