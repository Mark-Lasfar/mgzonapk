import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/api/services/api-key.service';
import { validatePermissions } from '@/lib/api/middleware/auth';

export async function POST(request: NextRequest) {
  try {
    // Validate admin permissions
    const permissionCheck = await validatePermissions(['admin'])(request);
    if (permissionCheck) return permissionCheck;

    const body = await request.json();
    const { name, permissions } = body;

    if (!name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Name is required',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const apiKey = await ApiKeyService.createApiKey({ name, permissions });

    return NextResponse.json({
      success: true,
      data: apiKey,
      timestamp: new Date().toISOString(),
    });
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