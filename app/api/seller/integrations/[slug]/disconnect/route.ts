import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { getTranslations } from 'next-intl/server';

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('seller_integrations_provider');
  
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      customLogger.warn('Unauthorized access', { requestId });
      return NextResponse.json({ error: t('Unauthorized') }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const result = await SellerIntegration.findOneAndUpdate(
      { 
        sellerId: session.user.id, 
        providerName: params.slug, 
        sandbox 
      },
      { 
        isActive: false, 
        status: 'disconnected', 
        lastUpdated: new Date(),
        credentials: null
      },
      { new: true }
    );

    if (!result) {
      return NextResponse.json({ error: t('Not Found') }, { status: 404 });
    }

    customLogger.info('Integration disconnected successfully', { requestId, provider: params.slug, sandbox });
    return NextResponse.json({ success: true, message: t('Disconnected Successfully') });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    customLogger.error('Failed to disconnect integration', { requestId, error: errorMessage });
    return NextResponse.json({ error: `${t('Error Title')}: ${errorMessage}` }, { status: 500 });
  }
}