import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Client from '@/lib/db/models/client.model';
import Seller from '@/lib/db/models/seller.model';
import OAuthState from '@/lib/db/models/oauth-state.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get('clientId');
    const sandbox = searchParams.get('sandbox') === 'true';

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    await connectToDatabase();
    const client = await Client.findById(clientId);
    if (!client || client.status !== 'approved') {
      return NextResponse.json({ error: 'Invalid or unapproved client' }, { status: 400 });
    }

    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const state = uuidv4();
    const redirectUri = client.redirectUris[0]; // استخدام أول URI متاح
    const authUrl = new URL(redirectUri);
    authUrl.searchParams.append('client_id', client.clientId);
    authUrl.searchParams.append('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/clients/oauth/callback?sandbox=${sandbox}`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', client.scopes.join(' '));
    authUrl.searchParams.append('state', state);

    await OAuthState.create({
      state,
      providerId: clientId,
      sellerId: seller._id,
      sandbox,
      createdAt: new Date(),
    });

    logger.info('OAuth authorization initiated for client', { requestId, clientId, sellerId: seller._id, sandbox });
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initiate OAuth for client', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}