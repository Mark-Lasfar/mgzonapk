import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import OAuthState from '@/lib/db/models/oauth-state.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { encrypt } from '@/lib/utils/encryption';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('api.clients.connect');
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      await customLogger.error('Unauthorized access to connect client', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const client = await Client.findById(params.id);
    if (!client || client.status !== 'approved') {
      await customLogger.error('Client not found or not approved', { requestId, clientId: params.id, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('not_found'), requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    // Check if already connected
    const existingIntegration = await SellerIntegration.findOne({
      sellerId: session.user.id,
      integrationId: params.id,
      sandbox,
    });
    if (existingIntegration && existingIntegration.isActive) {
      await customLogger.warn('Client already connected', { requestId, clientId: params.id, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('already_connected'), requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    let redirectUrl: string | null = null;
    if (client.oauth?.enabled) {
      // Handle OAuth flow
      const authUrl = new URL(client.authorizationUrl!);
      authUrl.searchParams.append('client_id', client.clientId);
      authUrl.searchParams.append(
        'redirect_uri',
        `${process.env.NEXT_PUBLIC_APP_URL}/api/clients/oauth/callback?sandbox=${sandbox}`
      );
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', client.oauth.scopes?.join(' ') || '');
      const state = uuidv4();
      await OAuthState.create({
        state,
        sellerId: session.user.id,
        providerId: client._id,
        sandbox,
        createdAt: new Date(),
      });
      authUrl.searchParams.append('state', state);
      redirectUrl = authUrl.toString();
    } else {
      // Handle API Key or other credentials
      const body = await req.json();
      const credentials = body.credentials || {};
      const encryptedCredentials = Object.fromEntries(
        Object.entries(credentials).map(([key, value]) => [key, encrypt(value as string)])
      );
      await SellerIntegration.create({
        sellerId: session.user.id,
        integrationId: client._id,
        providerName: client.name,
        sandbox,
        isActive: true,
        status: 'connected',
        credentials: encryptedCredentials,
        connectionType: 'api_key',
        history: [{ event: 'connected', date: new Date() }],
      });
    }

    await customLogger.info('Client connection initiated', {
      requestId,
      clientId: params.id,
      sellerId: session.user.id,
      sandbox,
      service: 'api',
    });
    return redirectUrl
      ? NextResponse.json({ success: true, redirectUrl })
      : NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to initiate client connection', {
      requestId,
      error: errorMessage,
      service: 'api',
    });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}