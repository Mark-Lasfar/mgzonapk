import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import ApiKeyModel from '@/lib/db/models/api-key.model';
import crypto from 'crypto';
import { headers } from 'next/headers';
import { logger } from '../services/logging';
import { getToken } from 'next-auth/jwt';

async function getCurrentUserInfo(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    return {
      timestamp: new Date().toISOString(),
      user: token?.email || token?.name || 'unknown'
    };
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      user: 'unknown'
    };
  }
}

export async function validateApiKey(request: NextRequest) {
  const { timestamp, user } = await getCurrentUserInfo(request);
  
  try {
    const apiKey = request.headers.get('x-api-key');
    const apiSecret = request.headers.get('x-api-secret');
    const requestTimestamp = request.headers.get('x-timestamp');
    const signature = request.headers.get('x-signature');
    const shipbobSignature = request.headers.get('x-shipbob-signature');
    const fourpxSignature = request.headers.get('x-4px-signature');

    if (shipbobSignature || fourpxSignature) {
      const body = await request.json();
      const provider = shipbobSignature ? 'shipbob' : '4px';
      const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
      
      if (!secret) {
        logger.security('Missing webhook secret', { timestamp, user, provider });
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Webhook secret not configured',
            timestamp
          }),
          { status: 500 }
        );
      }

      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(JSON.stringify(body)).digest('hex');
      const receivedSignature = shipbobSignature || fourpxSignature;

      if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(receivedSignature!))) {
        logger.security('Invalid webhook signature', { timestamp, user, provider });
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Invalid webhook signature',
            timestamp
          }),
          { status: 401 }
        );
      }

      return null;
    }

    if (!apiKey || !apiSecret || !requestTimestamp || !signature) {
      logger.security('Missing authentication headers', { timestamp, user });
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Missing authentication headers',
          timestamp
        }),
        { status: 401 }
      );
    }

    await connectToDatabase();
    const key = await ApiKeyModel.findOne({ key: apiKey, isActive: true });

    if (!key) {
      logger.security('Invalid API key', { apiKey, timestamp, user });
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Invalid API key',
          timestamp
        }),
        { status: 401 }
      );
    }

    const requestTime = new Date(requestTimestamp);
    const now = new Date();
    const timeDiff = Math.abs(now.getTime() - requestTime.getTime());
    if (timeDiff > 5 * 60 * 1000) {
      logger.security('Request timestamp expired', { apiKey, requestTime, timestamp, user });
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Request timestamp expired',
          timestamp
        }),
        { status: 401 }
      );
    }

    const expectedSignature = crypto
      .createHmac('sha256', key.secret)
      .update(`${apiKey}${requestTimestamp}`)
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.security('Invalid signature', { apiKey, timestamp, user });
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Invalid signature',
          timestamp
        }),
        { status: 401 }
      );
    }

    await ApiKeyModel.findByIdAndUpdate(key._id, {
      lastUsed: now,
      updatedAt: now,
      updatedBy: user
    });

    return null;
  } catch (error) {
    logger.error(new Error('API key validation error'), {
      error: error instanceof Error ? error.message : String(error),
      timestamp,
      user
    });
    return new NextResponse(
      JSON.stringify({
        success: false,
        error: 'Authentication error',
        timestamp
      }),
      { status: 500 }
    );
  }
}

export function validatePermissions(requiredPermissions: string[]) {
  return async (request: NextRequest) => {
    const { timestamp, user } = await getCurrentUserInfo(request);
    
    try {
      const apiKey = request.headers.get('x-api-key');
      if (!apiKey) {
        logger.security('Missing API key', { timestamp, user });
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'API key required',
            timestamp
          }),
          { status: 401 }
        );
      }

      await connectToDatabase();
      const key = await ApiKeyModel.findOne({ key: apiKey });

      if (!key) {
        logger.security('Invalid API key', { apiKey, timestamp, user });
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Invalid API key',
            timestamp
          }),
          { status: 401 }
        );
      }

      const hasPermission = requiredPermissions.every((permission) =>
        key.permissions.includes(permission.toLowerCase())
      );

      if (!hasPermission) {
        logger.security('Insufficient permissions', {
          apiKey,
          requiredPermissions,
          providedPermissions: key.permissions,
          timestamp,
          user
        });
        return new NextResponse(
          JSON.stringify({
            success: false,
            error: 'Insufficient permissions',
            timestamp
          }),
          { status: 403 }
        );
      }

      return null;
    } catch (error) {
      logger.error(new Error('Permission validation error'), {
        error: error instanceof Error ? error.message : String(error),
        timestamp,
        user
      });
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Permission validation error',
          timestamp
        }),
        { status: 500 }
      );
    }
  };
}

export async function cors() {
  const headersList = await headers();
  const origin = headersList.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-api-secret, x-timestamp, x-signature, x-shipbob-signature, x-4px-signature',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}