import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getSellerApiKeys,
  createSellerApiKey,
  rotateSellerApiKey,
  deactivateSellerApiKey,
} from '@/lib/actions/seller.actions';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const apiKeySchema = z.object({
  name: z.string().min(1, 'API Key name is required').max(100, 'API Key name cannot exceed 100 characters'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const locale = req.headers.get('accept-language') || 'en';
    const result = await getSellerApiKeys(session.user.id, locale);
    if (!result.success) {
      logger.error('Failed to retrieve API Keys', { requestId, error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (!result.data) {
      logger.error('No data returned from getSellerApiKeys', { requestId });
      return NextResponse.json({ error: 'No data available' }, { status: 400 });
    }

    const apiKeys = result.data.map((key: any) => ({
      id: key._id,
      name: key.name,
      key: key.key.substring(0, 8) + '****',
      permissions: key.permissions,
      isActive: key.isActive,
      lastUsed: key.lastUsed,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));

    logger.info('API Keys retrieved', { requestId, sellerId: session.user.id });
    return NextResponse.json({ success: true, data: apiKeys });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve API Keys';
    logger.error('Failed to retrieve API Keys', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsedData = apiKeySchema.parse(body);
    const locale = req.headers.get('accept-language') || 'en';

    // التحقق من صحة الصلاحيات
    const validPermissions = [
      'profile:read', 'profile:write',
      'products:read', 'products:write',
      'orders:read', 'orders:write',
      'customers:read', 'customers:write',
      'inventory:read', 'inventory:write',
      'analytics:read',
    ];
    const invalidPermissions = parsedData.permissions.filter((p: string) => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return NextResponse.json(
        { error: `Invalid permissions: ${invalidPermissions.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await createSellerApiKey(session.user.id, parsedData.name, parsedData.permissions, undefined, locale);
    if (!result.success) {
      logger.error('Failed to create API Key', { requestId, error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (!result.data) {
      logger.error('No data returned from createSellerApiKey', { requestId });
      return NextResponse.json({ error: 'Failed to create API Key' }, { status: 400 });
    }

    logger.info('API Key created', { requestId, sellerId: session.user.id, apiKeyId: result.data._id });
    return NextResponse.json({
      success: true,
      data: { id: result.data._id, key: result.data.key, name: result.data.name, permissions: result.data.permissions },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create API Key';
    logger.error('Failed to create API Key', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const apiKeyId = searchParams.get('apiKeyId');
    const action = searchParams.get('action');

    if (!apiKeyId || action !== 'rotate') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const locale = req.headers.get('accept-language') || 'en';
    const result = await rotateSellerApiKey(session.user.id, apiKeyId, locale);
    if (!result.success) {
      logger.error('Failed to rotate API Key', { requestId, error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (!result.data) {
      logger.error('No data returned from rotateSellerApiKey', { requestId });
      return NextResponse.json({ error: 'Failed to rotate API Key' }, { status: 400 });
    }

    logger.info('API Key rotated', { requestId, sellerId: session.user.id, apiKeyId });
    return NextResponse.json({
      success: true,
      data: { id: result.data._id, key: result.data.key, name: result.data.name, permissions: result.data.permissions },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to rotate API Key';
    logger.error('Failed to rotate API Key', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const apiKeyId = searchParams.get('apiKeyId');
    if (!apiKeyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
    }

    const locale = req.headers.get('accept-language') || 'en';
    const result = await deactivateSellerApiKey(session.user.id, apiKeyId, locale);
    if (!result.success) {
      logger.error('Failed to deactivate API Key', { requestId, error: result.error });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    logger.info('API Key deactivated', { requestId, sellerId: session.user.id, apiKeyId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate API Key';
    logger.error('Failed to deactivate API Key', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}