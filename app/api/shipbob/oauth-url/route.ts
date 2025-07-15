import { NextResponse } from 'next/server';
import { logger } from '@/lib/api/services/logging';
import crypto from 'crypto';

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const authUrl = `https://api.shipbob.com/oauth/authorize?client_id=${process.env.SHIPBOB_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.SHIPBOB_REDIRECT_URI!)}&state=${requestId}&scope=read+write`;
    await logger.info('Generated ShipBob OAuth URL', { requestId, service: 'api' });
    return NextResponse.json({ url: authUrl, success: true, requestId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error('Failed to generate OAuth URL', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json({ success: false, error: 'Failed to generate URL', requestId }, { status: 500 });
  }
}