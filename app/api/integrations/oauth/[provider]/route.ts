// /app/api/integrations/oauth/[provider]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import OAuthState from '@/lib/db/models/oauth-state.model';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { decrypt } from '@/lib/utils/encryption';

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      customLogger.warn('Unauthorized_access_attempt', { requestId });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';
    const provider = params.provider;

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      customLogger.error('Missing_APP_URL_environment_variable', { requestId });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    await connectToDatabase(sandbox ? 'sandbox' : 'live');
    const integration = await Integration.findOne({ providerName: provider }).lean();
    if (!integration || !integration.oauth.enabled) {
      customLogger.warn('Invalid_or_non_OAuth_integration', { requestId, provider });
      return NextResponse.json({ error: 'Invalid or non-OAuth integration' }, { status: 400 });
    }

    const clientId = integration.credentials.get('clientId');
    const clientSecret = integration.credentials.get('clientSecret');
    if (!clientId || !clientSecret) {
      customLogger.error('Missing_OAuth_credentials', { requestId, provider });
      return NextResponse.json({ error: 'Missing OAuth credentials' }, { status: 400 });
    }

    const state = uuidv4();
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${integration._id}/callback?sandbox=${sandbox}`;
    const authUrl = new URL(integration.oauth.authorizationUrl!);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', integration.oauth.scopes?.join(' ') || '');
    authUrl.searchParams.append('state', state);

    await OAuthState.create({
      state,
      providerId: integration._id,
      sellerId: session.user.id,
      sandbox,
      createdAt: new Date(),
    });

    customLogger.info('OAuth_initiated_for_provider', { requestId, provider, sandbox });
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    customLogger.error('Failed_to_initiate_OAuth', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}