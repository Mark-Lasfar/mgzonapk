import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import ApiKey from '@/lib/db/models/api-key.model';
import User from '@/lib/db/models/user.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import crypto from 'crypto';
import { encrypt } from '@/lib/utils/encryption';
import { getTranslations } from 'next-intl/server';

const apiKeySchema = z.object({
  name: z.string().min(1, 'API Key name is required').max(100, 'API Key name cannot exceed 100 characters'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const locale = req.headers.get('accept-language') || 'en';
    const t = await getTranslations({ locale, namespace: 'api' });

    const user = await User.findOne({ _id: session.user.id }).select('apiKeys').populate('apiKeys');
    if (!user) {
      return NextResponse.json({ error: t('errors.userNotFound') }, { status: 404 });
    }

    const apiKeysArray = user.apiKeys || [];
    const apiKeys = apiKeysArray.map((key: any) => ({
      id: key._id,
      name: key.name,
      key: key.key,
      permissions: key.permissions,
      isActive: key.isActive,
      lastUsed: key.lastUsed,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
    }));

    logger.info('API Keys retrieved for user', { requestId, userId: session.user.id });
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsedData = apiKeySchema.parse(body);
    const locale = req.headers.get('accept-language') || 'en';
    const t = await getTranslations({ locale, namespace: 'api' });

    await connectToDatabase();

    const user = await User.findOne({ _id: session.user.id });
    if (!user) {
      return NextResponse.json({ error: t('errors.userNotFound') }, { status: 404 });
    }

    // تعريف الصلاحيات المسموح بها
    const userAllowedPermissions = ['profile:read', 'profile:write'];
    const sellerOnlyPermissions = [
      'products:read', 'products:write',
      'orders:read', 'orders:write',
      'customers:read', 'customers:write',
      'inventory:read', 'inventory:write',
      'analytics:read',
    ];

    // التحقق من الصلاحيات
    const forbiddenPermissions = parsedData.permissions.filter((p: string) =>
      !userAllowedPermissions.includes(p) && sellerOnlyPermissions.includes(p)
    );

    if (user.role !== 'SELLER' && forbiddenPermissions.length > 0) {
      return NextResponse.json(
        { error: t('errors.forbiddenPermissions', { permissions: forbiddenPermissions.join(', ') }) },
        { status: 403 }
      );
    }

    // التحقق من صحة الصلاحيات
    const validPermissions = [...userAllowedPermissions, ...sellerOnlyPermissions];
    const invalidPermissions = parsedData.permissions.filter((p: string) => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      return NextResponse.json({ error: t('errors.invalidPermissions') }, { status: 400 });
    }

    const apiKeyData: any = {
      name: parsedData.name,
      key: `mgz_${crypto.randomBytes(16).toString('hex')}`,
      secret: encrypt(crypto.randomBytes(32).toString('hex')),
      permissions: parsedData.permissions,
      userId: user._id,
      createdBy: user._id,
      updatedBy: user._id,
      isActive: true,
    };

    // أضف sellerId فقط إذا كان المستخدم بائعًا
    if (user.role === 'SELLER') {
      apiKeyData.sellerId = user._id;
    }

    const apiKey = new ApiKey(apiKeyData);


    await apiKey.save();
    user.apiKeys = user.apiKeys || [];
    user.apiKeys.push(apiKey._id.toString());
    await user.save();

    logger.info('API Key created for user', { requestId, userId: session.user.id, apiKeyId: apiKey._id });
    return NextResponse.json({
      success: true,
      data: { id: apiKey._id, key: apiKey.key, name: apiKey.name, permissions: apiKey.permissions },
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const apiKeyId = searchParams.get('apiKeyId');
    const action = searchParams.get('action');

    if (!apiKeyId || action !== 'rotate') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const locale = req.headers.get('accept-language') || 'en';
    const t = await getTranslations({ locale, namespace: 'api' });

    await connectToDatabase();

    const user = await User.findOne({ _id: session.user.id });
    if (!user) {
      return NextResponse.json({ error: t('errors.userNotFound') }, { status: 404 });
    }

    const apiKey = await ApiKey.findOne({ _id: apiKeyId, userId: user._id });
    if (!apiKey) {
      return NextResponse.json({ error: t('errors.apiKeyNotFound') }, { status: 404 });
    }

    apiKey.key = `mgz_${crypto.randomBytes(16).toString('hex')}`;
    apiKey.secret = encrypt(crypto.randomBytes(32).toString('hex'));
    apiKey.updatedBy = user._id;
    apiKey.updatedAt = new Date();
    await apiKey.save();

    logger.info('API Key rotated for user', { requestId, userId: session.user.id, apiKeyId });
    return NextResponse.json({
      success: true,
      data: { id: apiKey._id, key: apiKey.key, name: apiKey.name, permissions: apiKey.permissions },
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const apiKeyId = searchParams.get('apiKeyId');
    if (!apiKeyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
    }

    const locale = req.headers.get('accept-language') || 'en';
    const t = await getTranslations({ locale, namespace: 'api' });

    await connectToDatabase();

    const user = await User.findOne({ _id: session.user.id });
    if (!user) {
      return NextResponse.json({ error: t('errors.userNotFound') }, { status: 404 });
    }

    const result = await ApiKey.deleteOne({ _id: apiKeyId, userId: user._id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: t('errors.apiKeyNotFound') }, { status: 404 });
    }

    user.apiKeys = (user.apiKeys || []).filter((id: any) => id.toString() !== apiKeyId);
    await user.save();

    logger.info('API Key deactivated for user', { requestId, userId: session.user.id, apiKeyId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to deactivate API Key';
    logger.error('Failed to deactivate API Key', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}