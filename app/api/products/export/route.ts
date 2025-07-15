import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import Seller from '@/lib/db/models/seller.model';
import { ShipBobService } from '@/lib/api/integrations/shipbob/service';
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

    const { productId, targetPlatform } = await request.json();
    if (!productId || !targetPlatform) {
      await customLogger.error('Missing productId or targetPlatform', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Product ID and target platform are required', requestId, timestamp: new Date().toISOString() },
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
    if (!seller) {
      await customLogger.error('Seller not found', { requestId, userId: session.user.id, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Seller not found', requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    let exportDetails;
    if (targetPlatform === 'shipbob') {
      if (!seller.shipbob?.accessToken || !seller.shipbob?.channelId) {
        await customLogger.error('ShipBob integration not connected', { requestId, userId: session.user.id, service: 'api' });
        return NextResponse.json(
          { success: false, error: 'ShipBob integration not connected', requestId, timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }

      const shipbobService = new ShipBobService({
        accessToken: seller.shipbob.accessToken,
        apiUrl: process.env.SHIPBOB_API_URL || 'https://api.shipbob.com',
        channelId: seller.shipbob.channelId,
      });

      const response = await shipbobService.createProduct({
        reference_id: product.sourceId || product._id.toString(),
        name: product.name,
        description: product.description,
        sku: product.sku || product._id.toString(),
        price: product.pricing.finalPrice,
        image_url: product.images[0] || '',
        inventory: product.countInStock,
      });

      exportDetails = {
        productId: product._id,
        targetPlatform,
        shipbobProductId: response.id,
        exportedAt: new Date(),
      };
    } else {
      await customLogger.error('Unsupported target platform', { requestId, targetPlatform, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Unsupported target platform', requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    await customLogger.info('Product exported successfully', { requestId, productId, targetPlatform, service: 'api' });
    return NextResponse.json({
      success: true,
      data: exportDetails,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Failed to export product', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      { success: false, error: 'Failed to export product', requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}