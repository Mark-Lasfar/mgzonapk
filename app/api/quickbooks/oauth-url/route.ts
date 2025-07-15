import { NextResponse } from 'next/server';
import { logger } from '@/lib/api/services/logging';
import crypto from 'crypto';

export async function GET() {
  const requestId = crypto.randomUUID();
  try {
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${process.env.QUICKBOOKS_CLIENT_ID}&response_type=code&scope=com.intuit.quickbooks.accounting&redirect_uri=${encodeURIComponent(process.env.QUICKBOOKS_REDIRECT_URI!)}&state=${requestId}`;
    logger.info('Generated QuickBooks OAuth URL', { requestId });
    return NextResponse.json({ url: authUrl, success: true, requestId });
  } catch (error) {
    logger.error('Failed to generate OAuth URL', { requestId, error: String(error) });
    return NextResponse.json({ success: false, error: 'Failed to generate URL', requestId }, { status: 500 });
  }
}