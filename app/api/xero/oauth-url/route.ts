// /app/api/xero/oauth-url/route.ts
import { NextResponse } from 'next/server';
import { logger } from '@/lib/api/services/logging';
import crypto from 'crypto';

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const authUrl = `https://login.xero.com/identity/connect/authorize?client_id=${process.env.XERO_CLIENT_ID}&response_type=code&scope=offline_access accounting.transactions&redirect_uri=${encodeURIComponent(process.env.XERO_REDIRECT_URI!)}&state=${requestId}`;
    logger.info('Generated Xero OAuth URL', { requestId });
    return NextResponse.json({ url: authUrl, success: true, requestId });
  } catch (error) {
    logger.error('Failed to generate OAuth URL', { requestId, error: String(error) });
    return NextResponse.json({ success: false, error: 'Failed to generate URL', requestId }, { status: 500 });
  }
}