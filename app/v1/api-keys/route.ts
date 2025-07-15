import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/api/services/api-key.service';
import { validatePermissions } from '@/lib/api/middleware/auth';

export async function POST(request: NextRequest) {
  try {
    const permissionCheck = await validatePermissions(['Admin'])(request);
    if (permissionCheck) return permissionCheck;

    const body = await request.json();
    const { name, permissions, sellerId } = body as { name?: string; permissions?: string[]; sellerId?: string };

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Name is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const apiKey = await ApiKeyService.createApiKey({ name, permissions: permissions || [], sellerId });

    return NextResponse.json(
      {
        success: true,
        data: apiKey,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}