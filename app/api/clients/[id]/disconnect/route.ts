import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Client from '@/lib/db/models/client.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '@/lib/utils/encryption';
import { getTranslations } from 'next-intl/server';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('api.clients.connect');
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: t('unauthorized') }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');
    const client = await Client.findById(params.id);
    if (!client || client.status !== 'approved') {
      return NextResponse.json({ error: t('client_not_found') }, { status: 404 });
    }

    // Check if already connected
    const existingIntegration = await SellerIntegration.findOne({
      sellerId: session.user.id,
      integrationId: params.id,
      sandbox,
    });
    if (existingIntegration && existingIntegration.isActive) {
      return NextResponse.json({ error: t('already_connected') }, { status: 400 });
    }

    let redirectUrl: string | null = null;
    if (client.oauth?.enabled) {
      // Handle OAuth flow
      const authUrl = new URL(client.oauth.authorizationUrl!);
      authUrl.searchParams.append('client_id', client.clientId);
      authUrl.searchParams.append(
        'redirect_uri',
        `${process.env.NEXT_PUBLIC_APP_URL}/api/clients/oauth/callback?sandbox=${sandbox}`
      );
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', client.oauth.scopes?.join(' ') || '');
      authUrl.searchParams.append('state', uuidv4());
      redirectUrl = authUrl.toString();
    } else {
      // Handle API Key or other credentials
      const encryptedCredentials = encrypt(JSON.stringify(client.credentials));
      await SellerIntegration.create({
        sellerId: session.user.id,
        integrationId: params.id,
        providerName: client.name,
        sandbox,
        isActive: true,
        status: 'connected',
        credentials: encryptedCredentials,
        history: [{ event: 'connected', date: new Date() }],
      });
    }

    logger.info('Client connection initiated', { requestId, clientId: params.id, sandbox });
    return redirectUrl
      ? NextResponse.json({ success: true, redirectUrl })
      : NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initiate client connection', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}