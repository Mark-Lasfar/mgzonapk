import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { ShipBobService } from '@/lib/api/integrations/shipbob/service';
import { customLogger } from '@/lib/api/services/logging';
import { auth } from '@/auth';
import crypto from 'crypto';

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const requestId = crypto.randomUUID();

  try {
    await connectToDatabase();
    const session = await auth();

    const { userId } = params;
    if (!userId) {
      await customLogger.error('User ID is required', { requestId, service: 'api' });
      return NextResponse.json(
        {
          success: false,
          error: 'User ID is required',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!session?.user?.id || session.user.id !== userId) {
      await customLogger.error('Unauthorized access to integrations', { requestId, userId, service: 'api' });
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const seller = await Seller.findOne({ userId }).lean();
    if (!seller) {
      await customLogger.error('Seller not found', { requestId, userId, service: 'api' });
      return NextResponse.json(
        {
          success: false,
          error: 'Seller not found',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    const integrations = [
      {
        id: 'shipbob',
        name: 'ShipBob',
        connected: !!seller.shipbob?.accessToken,
      },
      {
        id: 'amazon',
        name: 'Amazon FBA',
        connected: !!seller.amazon?.refreshToken,
      },
    ];

    if (seller.shipbob?.accessToken && seller.shipbob?.channelId) {
      const shipbobService = new ShipBobService({
        accessToken: seller.shipbob.accessToken,
        apiUrl: process.env.SHIPBOB_API_URL || 'https://api.shipbob.com',
        channelId: seller.shipbob.channelId,
      });
      const connectionStatus = await shipbobService.checkConnection();
      integrations[0].connected = connectionStatus.status === 'connected';
    }

    return NextResponse.json({
      success: true,
      data: integrations,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Failed to fetch integrations', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch integrations',
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { userId: string } }) {
  const requestId = crypto.randomUUID();

  try {
    await connectToDatabase();
    const session = await auth();

    const { userId } = params;
    const integrationId = request.nextUrl.searchParams.get('integrationId');

    if (!userId || !integrationId) {
      await customLogger.error('Missing user ID or integration ID', { requestId, integrationId, requestId, service: 'api' });
      return NextResponse.json(
        {
          success: false,
          error: 'User ID and integration ID are required',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!session?.user?.id || session.user.id !== userId) {
      await customLogger.error('Unauthorized access to delete integration', { requestId, userId, integrationId, service: 'api' });
      return null;
    }

    const seller = await Seller.findOneAndUpdate(
      { userId },
      { $unset: { [integrationId]: '' } },
      { new: true }
    );

    if (!seller) {
      await customLogger.error('Seller not found', { userId, integrationId, requestId, service: 'api' });
      return NextResponse.json(
        {
          success: false,
          error: 'Seller not found',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    await customLogger.info('Integration disconnected', { userId, requestId, service: 'api' });
    return NextResponse.json({
      success: true,
      message: 'Integration deleted successfully',
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Failed to disconnect integration', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to disconnect integration',
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}