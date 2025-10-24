// /home/mark/Music/my-nextjs-project-clean/app/api/order/track/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { DynamicIntegrationService } from '@/lib/services/integrations';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { TrackingData } from '@/lib/types';

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      customLogger.warn('Unauthorized_access', { requestId });
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { supplierId, trackingNumber } = await req.json();
    if (!supplierId || !trackingNumber) {
      customLogger.warn('Missing_required_fields', { requestId, supplierId, trackingNumber });
      return NextResponse.json({ success: false, message: 'Missing supplierId or trackingNumber' }, { status: 400 });
    }

    await connectToDatabase();
    const integration = await Integration.findOne({ _id: supplierId, type: { $in: ['dropshipping', 'shipping'] }, isActive: true });
    if (!integration) {
      customLogger.warn('Integration_not_found', { requestId, supplierId });
      return NextResponse.json({ success: false, message: 'Integration not found' }, { status: 404 });
    }

    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: session.user.id,
      integrationId: supplierId,
      isActive: true,
      status: 'connected',
    });
    if (!sellerIntegration) {
      customLogger.warn('Integration_not_connected', { requestId, supplierId, sellerId: session.user.id });
      return NextResponse.json({ success: false, message: 'Integration not connected' }, { status: 400 });
    }

    const dynamicIntegrationService = new DynamicIntegrationService(
      {
        _id: integration._id.toString(),
        type: integration.type,
        status: sellerIntegration.status,
        providerName: integration.providerName,
        settings: integration.settings,
        logoUrl: integration.logoUrl,
        webhook: sellerIntegration.webhook,
      },
      sellerIntegration
    );

    const trackingData: TrackingData = await dynamicIntegrationService.trackOrder(trackingNumber);
    if (!trackingData.success || !trackingData.trackingUrl) {
      customLogger.warn('Failed_to_fetch_tracking', { requestId, supplierId, trackingNumber });
      return NextResponse.json({
        success: false,
        message: trackingData.error || 'Failed to fetch tracking information',
      }, { status: 400 });
    }

    customLogger.info('Order_tracked_successfully', {
      requestId,
      supplierId,
      trackingNumber,
      trackingUrl: trackingData.trackingUrl,
      status: trackingData.status,
      carrier: trackingData.carrier,
    });
    return NextResponse.json({
      success: true,
      data: {
        trackingUrl: trackingData.trackingUrl,
        status: trackingData.status,
        estimatedDeliveryDate: trackingData.estimatedDeliveryDate,
        carrier: trackingData.carrier,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Server error';
    customLogger.error('Failed_to_track_order', { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}