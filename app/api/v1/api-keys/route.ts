import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/api/services/api-key.service';
import { validatePermissions } from '@/lib/api/middleware/auth';
import ApiKey from '@/lib/db/models/api-key.model';
import { getToken } from 'next-auth/jwt';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    // Validate admin permissions
    const permissionCheck = await validatePermissions(['admin'])(request);
    if (permissionCheck) return permissionCheck;

    // Fetch API keys from the database
    const apiKeys = await ApiKey.find({ isActive: true }).select('_id name key createdAt permissions');

    return NextResponse.json({
      success: true,
      data: { apiKeys },
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

    // Get current user from session
    const token = await getToken({ req: request });
    const createdBy = token?.email || 'system';

    const apiKey = await ApiKeyService.createApiKey(
      {
        name,
        permissions: permissions || ['products:read', 'orders:read'],
        sellerId: new mongoose.Types.ObjectId(), // Placeholder, will be updated for Seller
      },
      { createdBy, updatedBy: createdBy }
    );

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