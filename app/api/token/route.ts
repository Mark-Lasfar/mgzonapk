import { NextRequest, NextResponse } from 'next/server';
import { OAuthService } from '@/lib/api/services/oauth.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { grant_type, code, client_id, client_secret, redirect_uri, refresh_token } = body;

    if (grant_type === 'authorization_code') {
      if (!code || !client_id || !client_secret || !redirect_uri) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
      }

      const result = await OAuthService.exchangeAuthCode({
        code,
        clientId: client_id,
        clientSecret: client_secret,
        redirectUri: redirect_uri,
      });

      return NextResponse.json({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_in: result.expiresIn,
        token_type: 'Bearer',
        scope: result.scopes.join(' '),
      });
    } else if (grant_type === 'refresh_token') {
      if (!refresh_token || !client_id || !client_secret) {
        return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
      }

      const result = await OAuthService.refreshAccessToken({
        refreshToken: refresh_token,
        clientId: client_id,
        clientSecret: client_secret,
      });

      return NextResponse.json({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_in: result.expiresIn,
        token_type: 'Bearer',
        scope: result.scopes.join(' '),
      });
    } else {
      return NextResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}