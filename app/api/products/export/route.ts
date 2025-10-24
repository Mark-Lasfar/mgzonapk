import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import Seller from '@/lib/db/models/seller.model';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { ImportExportService } from '@/lib/services/marketplace/import-export';
import { customLogger } from '@/lib/api/services/logging';
import { auth } from '@/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized product export request', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { productId, targetPlatform, sellerId, region = 'global' } = await request.json();
    if (!productId || !targetPlatform || !sellerId) {
      await customLogger.error('Missing productId, targetPlatform, or sellerId', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Product ID, target platform, and sellerId are required', requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const product = await Product.findById(productId);
    if (!product) {
      await customLogger.error('Product not found', { requestId, productId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Product not found', requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller || seller._id.toString() !== sellerId) {
      await customLogger.error('Seller not found or unauthorized', { requestId, userId: session.user.id, sellerId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Seller not found or unauthorized', requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    const integration = await Integration.findOne({ providerName: targetPlatform, type: 'marketplace', isActive: true });
    if (!integration) {
      await customLogger.error('Integration not found', { requestId, targetPlatform, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Integration not found', requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: seller._id,
      integrationId: integration._id,
      isActive: true,
      status: 'connected',
    });
    if (!sellerIntegration) {
      await customLogger.error('Seller integration not connected', { requestId, targetPlatform, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Integration not connected', requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const importExportService = new ImportExportService();
    const exportResult = await importExportService.exportProduct(targetPlatform, sellerId, {
      productId,
      region,
    });

    await customLogger.info('Product exported successfully', {
      requestId,
      productId,
      targetPlatform,
      sellerId,
      exportedId: exportResult.exportedId,
      service: 'api',
    });

    return NextResponse.json({
      success: true,
      data: {
        productId,
        targetPlatform,
        exportedId: exportResult.exportedId,
        exportedAt: new Date(),
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await customLogger.error('Failed to export product', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}