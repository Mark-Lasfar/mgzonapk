// /app/api/seller/[customSiteUrl]/integrations/oauth/authorize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import Seller from '@/lib/db/models/seller.model';
import OAuthState from '@/lib/db/models/oauth-state.model';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { getTranslations } from 'next-intl/server';

export async function GET(req: NextRequest, { params }: { params: { customSiteUrl: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('seller.integrations');
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      customLogger.warn('Unauthorized_access_attempt', { requestId });
      return NextResponse.json({ error: t('unauthorized') }, { status: 401 });
    }

    const { customSiteUrl } = params;
    const { searchParams } = new URL(req.url);
    const providerId = searchParams.get('provider');

    if (!providerId) {
      customLogger.warn('Provider_required', { requestId });
      return NextResponse.json({ error: t('provider_required') }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_APP_URL) {
      customLogger.error('Missing_APP_URL_environment_variable', { requestId });
      return NextResponse.json({ error: t('server_config_error') }, { status: 500 });
    }

    await connectToDatabase(); // إزالة الساندبوكس

    const seller = await Seller.findOne({ customSiteUrl });
    if (!seller) {
      customLogger.warn('Seller_not_found', { requestId, customSiteUrl });
      return NextResponse.json({ error: t('seller_not_found') }, { status: 404 });
    }

    if (seller.userId.toString() !== session.user.id) {
      customLogger.warn('Seller_does_not_belong_to_user', { requestId, customSiteUrl, userId: session.user.id });
      return NextResponse.json({ error: t('unauthorized') }, { status: 403 });
    }

    const integration = await Integration.findOne({ providerName: providerId, enabledBySellers: seller._id });
    if (!integration || !integration.oauth.enabled) {
      customLogger.warn('Invalid_or_non_OAuth_integration', { requestId, providerId });
      return NextResponse.json({ error: t('invalid_oauth_integration') }, { status: 400 });
    }

    const clientId = integration.credentials.get('clientId');
    if (!clientId) {
      customLogger.error('Missing_client_id', { requestId, providerId });
      return NextResponse.json({ error: t('missing_client_id') }, { status: 400 });
    }

    const state = uuidv4();
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${providerId}/callback`;
    const authUrl = new URL(integration.oauth.authorizationUrl!);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', integration.oauth.scopes?.join(' ') || '');
    authUrl.searchParams.append('state', state);

    await OAuthState.create({
      state,
      providerId,
      sellerId: seller._id,
      createdAt: new Date(),
    });

    customLogger.info('OAuth_authorization_initiated', {
      requestId,
      providerId,
      sellerId: seller._id,
    });

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    customLogger.error('Failed_to_initiate_OAuth', { requestId, error: errorMessage });
    return NextResponse.json({ error: t('error', { message: errorMessage }) }, { status: 500 });
  }
}