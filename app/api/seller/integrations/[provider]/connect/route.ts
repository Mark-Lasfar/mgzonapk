import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '@/lib/utils/encryption';
import { generateOAuthUrl } from '@/lib/utils/integration';

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const integration = await Integration.findOne({ providerName: params.provider });
    if (!integration || !integration.isActive) {
      return NextResponse.json({ error: 'Integration not found or inactive' }, { status: 404 });
    }

    const existingIntegration = await SellerIntegration.findOne({
      sellerId: session.user.id,
      integrationId: integration._id,
      sandbox,
    });
    if (existingIntegration && existingIntegration.isActive) {
      return NextResponse.json({ error: 'Integration already connected' }, { status: 400 });
    }

    let redirectUrl: string | null = null;
    if (integration.oauth?.enabled) {
      redirectUrl = generateOAuthUrl({
        integration,
        baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
        sandbox,
      });
    } else {
      const credentials = req.body ? await req.json() : {};
      const encryptedCredentials = encrypt(JSON.stringify(credentials));
      await SellerIntegration.create({
        sellerId: session.user.id,
        integrationId: integration._id,
        providerName: integration.providerName,
        sandbox,
        isActive: true,
        status: 'connected',
        credentials: encryptedCredentials,
        history: [{ event: 'connected', date: new Date() }],
      });
    }

    logger.info('Integration connection initiated', { requestId, provider: params.provider, sandbox });
    return redirectUrl
      ? NextResponse.json({ success: true, redirectUrl })
      : NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initiate connection', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}