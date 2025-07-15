import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import { ApiKeyService } from '@/lib/api/services/api-key.service';
import { ApiKeyRequest } from '@/lib/api/types';
import ApiKey from '@/lib/db/models/api-key.model';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!['Admin', 'SELLER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const body: ApiKeyRequest = await request.json();
    await connectToDatabase();

    const apiKey = await ApiKeyService.createApiKey({
      name: body.name,
      permissions: body.permissions || ['products:read', 'orders:read'],
      expiresAt: body.expiresAt,
    });

    return NextResponse.json({
      success: true,
      data: {
        key: apiKey.key,
        secret: apiKey.secret,
        name: apiKey.name,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (!['Admin', 'SELLER'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const apiKeys = await ApiKey.find({ userId: session.user.id }).select('-secret');

    return NextResponse.json({
      success: true,
      data: apiKeys,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}