import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import ApiKeyModel from '@/lib/db/models/api-key.model';
import { auth } from '@/auth';
import { ApiKeyRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: ApiKeyRequest = await request.json();

    await connectToDatabase();

    const apiKey = await ApiKeyModel.create({
      userId: session.user.id,
      name: body.name,
      permissions: body.permissions || ['products:read', 'orders:read'],
      expiresAt: body.expiresAt,
    });

    // Only return the key and secret once
    const { key, secret } = apiKey;

    return NextResponse.json({
      success: true,
      data: {
        key,
        secret,
        name: apiKey.name,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const apiKeys = await ApiKeyModel.find({
      userId: session.user.id,
    }).select('-secret');

    return NextResponse.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}