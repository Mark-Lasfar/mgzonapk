import { NextRequest, NextResponse } from 'next/server';
import { customLogger } from '@/lib/api/services/logging';

export async function validateApiKey(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const apiKey = request.headers.get('x-api-key');

  if (!apiKey) {
    await customLogger.error('Missing API key in request', { service: 'api', requestId });
    return NextResponse.json(
      { error: 'Missing API key', success: false, requestId, timestamp: new Date().toISOString() },
      { status: 401 }
    );
  }

  const validApiKey = process.env.API_KEY;
  if (apiKey !== validApiKey) {
    await customLogger.security('Invalid API key attempt', { service: 'api', apiKey, requestId });
    return NextResponse.json(
      { error: 'Invalid API key', success: false, requestId, timestamp: new Date().toISOString() },
      { status: 401 }
    );
  }

  await customLogger.info('API key validated successfully', { service: 'api', requestId });
  return null;
}