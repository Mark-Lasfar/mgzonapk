

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
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
    const providerId = searchParams.get('providerId');
    const sandbox = searchParams.get('sandbox') === 'true';

    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    await connectToDatabase();
    const integration = await Integration.findById(providerId);
    if (!integration || !integration.oauth.enabled) {
      return NextResponse.json({ error: 'Invalid or non-OAuth integration' }, { status: 400 });
    }

    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const state = uuidv4();
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/callback?sandbox=${sandbox}`;
    const authUrl = new URL(integration.oauth.authorizationUrl!);
    authUrl.searchParams.append('client_id', integration.credentials.get('clientId')!);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', integration.oauth.scopes?.join(' ') || '');
    authUrl.searchParams.append('state', state);

    await OAuthState.create({
      state,
      providerId,
      sellerId: seller._id,
      sandbox,
      createdAt: new Date(),
    });

    logger.info('OAuth authorization initiated', { requestId, providerId, sellerId: seller._id, sandbox });
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to initiate OAuth', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}