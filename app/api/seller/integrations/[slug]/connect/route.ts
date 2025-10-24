// /app/api/seller/integrations/[provider]/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '@/lib/utils/encryption';
import mongoose from 'mongoose';
import { getTranslations } from 'next-intl/server';
import OAuthState from '@/lib/db/models/oauth-state.model';

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('seller_integrations_provider');
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const authSession = await auth();
    if (!authSession?.user?.id || authSession.user.role !== 'SELLER') {
      customLogger.warn('Unauthorized_access', { requestId });
      return NextResponse.json({ error: t('Unauthorized') }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      customLogger.error('Missing_APP_URL_environment_variable', { requestId });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const integration = await Integration.findOne({ providerName: params.provider }).session(session);
    if (!integration || !integration.isActive) {
      customLogger.warn('Integration_not_found_or_inactive', { requestId, provider: params.provider });
      return NextResponse.json({ error: t('Not_Found') }, { status: 404 });
    }

    const existingIntegration = await SellerIntegration.findOne({
      sellerId: authSession.user.id,
      integrationId: integration._id,
      sandbox,
    }).session(session);
    if (existingIntegration && existingIntegration.isActive) {
      customLogger.warn('Integration_already_connected', { requestId, provider: params.provider });
      return NextResponse.json({ error: 'Integration already connected' }, { status: 400 });
    }

    let redirectUrl: string | null = null;
    if (integration.oauth?.enabled) {
      const state = uuidv4();
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${integration._id}/callback?sandbox=${sandbox}`;
      const authUrl = new URL(integration.oauth.authorizationUrl!);
      const clientId = integration.credentials.get('clientId');
      if (!clientId) {
        customLogger.error('Missing_client_id', { requestId, provider: params.provider });
        return NextResponse.json({ error: 'Missing OAuth client ID' }, { status: 400 });
      }
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', integration.oauth.scopes?.join(' ') || '');
      authUrl.searchParams.append('state', state);

      await OAuthState.create({
        state,
        providerId: integration._id,
        sellerId: authSession.user.id,
        sandbox,
        createdAt: new Date(),
      }, { session });

      redirectUrl = authUrl.toString();
    } else {
      const body = await req.json().catch(() => ({}));
      const credentials = body.credentials || {};
      const encryptedCredentials = Object.fromEntries(
        Object.entries(credentials).map(([key, value]) => [key, encrypt(value as string)])
      );

      await SellerIntegration.create([{
        sellerId: authSession.user.id,
        integrationId: integration._id,
        providerName: integration.providerName,
        sandbox,
        isActive: true,
        status: 'connected',
        credentials: encryptedCredentials,
        connectionType: 'manual',
        history: [{ event: 'connected', date: new Date() }],
      }], { session });
    }

    await session.commitTransaction();
    customLogger.info('Integration_connection_initiated', { requestId, provider: params.provider, sandbox });
    return redirectUrl
      ? NextResponse.json({ success: true, redirectUrl })
      : NextResponse.json({ success: true });
  } catch (error) {
    await session.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : String(error);
    customLogger.error('Failed_to_initiate_connection', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  } finally {
    session.endSession();
  }
}