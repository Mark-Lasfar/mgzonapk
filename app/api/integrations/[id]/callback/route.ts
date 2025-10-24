// /app/api/integrations/[id]/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import OAuthState from '@/lib/db/models/oauth-state.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { getTranslations } from 'next-intl/server';
import mongoose from 'mongoose';
import Seller from '@/lib/db/models/seller.model';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const requestId = uuidv4();
  const t = await getTranslations('integrations.callback');
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const authSession = await auth();
    if (!authSession?.user?.id || authSession.user.role !== 'SELLER') {
      return NextResponse.json({ error: t('unauthorized') }, { status: 401 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json({ error: t('invalid_callback_params') }, { status: 400 });
    }

    await connectToDatabase(); // إزالة الساندبوكس

    // التحقق من صحة state
    const oauthState = await OAuthState.findOne({ state, providerId: id }).session(session);
    if (!oauthState) {
      return NextResponse.json({ error: t('invalid_state') }, { status: 400 });
    }

    const integration = await Integration.findOne({ providerName: id }).session(session);
    if (!integration || !integration.oauth.enabled) {
      return NextResponse.json({ error: t('integration_not_found') }, { status: 404 });
    }

    const tokenResponse = await axios.post<TokenResponse>(
      integration.oauth.tokenUrl!,
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/${id}/callback`,
        client_id: integration.credentials.get('clientId'),
        client_secret: decrypt(integration.credentials.get('clientSecret') || ''),
      },
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    const seller = await Seller.findOne({ userId: authSession.user.id }).session(session);
    if (!seller) {
      return NextResponse.json({ error: t('seller_not_found') }, { status: 404 });
    }

    const sellerIntegration = await SellerIntegration.findOneAndUpdate(
      {
        integrationId: integration._id,
        sellerId: seller._id,
        connectionType: 'oauth',
      },
      {
        accessToken: encrypt(access_token),
        refreshToken: refresh_token ? encrypt(refresh_token) : undefined,
        expiresAt: expires_in ? new Date(Date.now() + expires_in * 1000) : undefined,
        isActive: true,
        status: 'connected',
        lastConnectedAt: new Date(),
        connectedBy: new mongoose.Types.ObjectId(authSession.user.id),
        connectedByRole: authSession.user.role,
        history: [
          {
            event: 'connected',
            date: new Date(),
            message: t('oauth_connected'),
          },
        ],
      },
      { upsert: true, new: true, session }
    );

    // حذف state بعد الاستخدام
    await OAuthState.deleteOne({ state, providerId: id }).session(session);

    logger.info('OAuth callback processed successfully', {
      requestId,
      integrationId: id,
      sellerId: seller._id,
    });

    await session.commitTransaction();
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/seller/integrations?success=true`
    );
  } catch (error) {
    await session.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('OAuth callback failed', { requestId, integrationId: params.id, error: errorMessage });
    return NextResponse.json({ error: `${t('error_title')}: ${errorMessage}` }, { status: 500 });
  } finally {
    session.endSession();
  }
}