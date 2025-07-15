import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '@/lib/utils/encryption';

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
    const integration = await Integration.findById(params.id);
    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Check if already connected
    const existingIntegration = await SellerIntegration.findOne({
      sellerId: session.user.id,
      integrationId: params.id,
      sandbox,
    });
    if (existingIntegration && existingIntegration.isActive) {
      return NextResponse.json({ error: 'Integration already connected' }, { status: 400 });
    }

    let redirectUrl: string | null = null;
    if (integration.oauth?.enabled) {
      // Handle OAuth flow
      const authUrl = new URL(integration.oauth.authorizationUrl!);
      authUrl.searchParams.append('client_id', integration.credentials.clientId);
      authUrl.searchParams.append(
        'redirect_uri',
        `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${params.id}/callback?sandbox=${sandbox}`
      );
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', integration.oauth.scopes?.join(' ') || '');
      authUrl.searchParams.append('state', uuidv4());
      redirectUrl = authUrl.toString();
    } else {
      // Handle API Key or other credentials
      const encryptedCredentials = encrypt(JSON.stringify(integration.credentials));
      await SellerIntegration.create({
        sellerId: session.user.id,
        integrationId: params.id,
        providerName: integration.providerName,
        sandbox,
        isActive: true,
        status: 'connected',
        credentials: encryptedCredentials,
        history: [{ event: 'connected', date: new Date() }],
      });
    }

    logger.info('Integration connection initiated', { requestId, integrationId: params.id, sandbox });
    return redirectUrl
      ? NextResponse.json({ success: true, redirectUrl })
      : NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initiate connection', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}