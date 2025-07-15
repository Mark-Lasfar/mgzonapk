import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { auth } from '@/auth';
import { customLogger } from '@/lib/api/services/logging';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized Amazon OAuth request', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('spapi_oauth_code');
    const state = searchParams.get('state');

    if (!code || !state || state !== session.user.id) {
      await customLogger.error('Invalid Amazon OAuth callback', { requestId, code, state, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Invalid OAuth parameters', requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const response = await fetch('https://api.amazon.com/auth/o2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.AMAZON_CLIENT_ID!,
        client_secret: process.env.AMAZON_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/amazon/oauth`,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      await customLogger.error('Amazon token exchange failed', { requestId, error: errorData.error_description, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Failed to exchange token', requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const { refresh_token } = await response.json();
    await Seller.updateOne(
      { userId: session.user.id },
      {
        $set: {
          amazon: {
            refreshToken: refresh_token,
            clientId: process.env.AMAZON_CLIENT_ID!,
            region: 'na',
            connectedAt: new Date(),
          },
        },
      },
      { upsert: true }
    );

    await customLogger.info('Amazon integration successful', { requestId, userId: session.user.id, service: 'api' });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?success=true`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Amazon OAuth error', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?error=${encodeURIComponent('Failed to connect Amazon')}`
    );
  }
}