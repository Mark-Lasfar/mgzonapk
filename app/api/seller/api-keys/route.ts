import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Seller from '@/lib/db/models/seller.model';
import ApiKey from '@/lib/db/models/api-key.model'; // استيراد نموذج ApiKey
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { encrypt } from '@/lib/utils/encryption';
import { z } from 'zod';
import mongoose, { Types } from 'mongoose';
import crypto from 'crypto'; // استيراد crypto

const apiKeySchema = z.object({
  name: z.string().min(1, 'API Key name is required').max(100, 'API Key name cannot exceed 100 characters'),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
});

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const seller = await Seller.findOne({ userId: session.user.id }).select('apiKeys').populate('apiKeys');
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const apiKeys = seller.apiKeys.map((key: any) => ({
      id: key._id,
      name: key.name,
      key: key.key.substring(0, 8) + '****', // إخفاء المفتاح
      scopes: key.permissions, // استخدام permissions بدلاً من scopes
      createdAt: key.createdAt,
    }));

    logger.info('API Keys retrieved', { requestId, sellerId: session.user.id });
    return NextResponse.json({ success: true, data: apiKeys });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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

    await connectToDatabase();

    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    // إنشاء مفتاح API جديد
    const apiKey = new ApiKey({
      name: parsedData.name,
      key: `mgz_${crypto.randomBytes(16).toString('hex')}`,
      secret: encrypt(crypto.randomBytes(32).toString('hex')), // تشفير السكرت
      permissions: parsedData.scopes, // استخدام permissions بدلاً من scopes
      sellerId: seller._id,
      createdBy: session.user.id,
      updatedBy: session.user.id,
      isActive: true,
    });

    await apiKey.save();

    // إضافة _id إلى apiKeys في Seller
    seller.apiKeys.push(apiKey._id);
    await seller.save();

    logger.info('API Key created', { requestId, sellerId: session.user.id, apiKeyId: apiKey._id });
    return NextResponse.json({
      success: true,
      data: { key: apiKey.key, name: apiKey.name, scopes: apiKey.permissions },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to create API Key', { requestId, error: errorMessage });
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
    const keyId = searchParams.get('keyId');

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
    }

    await connectToDatabase();

    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    // إزالة المفتاح من ApiKey collection
    const result = await ApiKey.deleteOne({ _id: keyId, sellerId: seller._id });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'API Key not found' }, { status: 404 });
    }

    // إزالة المفتاح من apiKeys في Seller
    seller.apiKeys = seller.apiKeys.filter((id: Types.ObjectId) => id.toString() !== keyId);
    await seller.save();

    logger.info('API Key deleted', { requestId, sellerId: session.user.id, keyId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to delete API Key', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}