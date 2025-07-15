import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';

export async function GET(request: NextRequest) {
  const authError = await validateApiKey(request);
  if (authError) return authError;

  const rateLimitResult = await rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const sort = searchParams.get('sort') || '-createdAt';

  try {
    await connectToDatabase();

    const query: any = {};
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: {
        items: products,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    }, {
      headers: rateLimitResult?.headers,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = await validateApiKey(request);
  if (authError) return authError;

  const rateLimitResult = await rateLimit(request);
  if (rateLimitResult instanceof NextResponse) return rateLimitResult;

  try {
    const body = await request.json();
    const { userId, provider, warehouseData, ...productData } = body;

    if (!provider || !warehouseData) {
      return NextResponse.json(
        { success: false, error: 'Provider and warehouse data are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const integration = await Integration.findOne({ providerName: provider, type: 'warehouse' });
    if (!integration || !integration.isActive) {
      return NextResponse.json(
        { success: false, error: 'Integration not found or inactive' },
        { status: 404 }
      );
    }

    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: userId,
      integrationId: integration._id,
      isActive: true,
    });
    if (!sellerIntegration) {
      return NextResponse.json(
        { success: false, error: 'Seller integration not found' },
        { status: 404 }
      );
    }

    const integrationService = new GenericIntegrationService(integration, sellerIntegration);
    const result = await integrationService.createProduct({
      sku: warehouseData.sku,
      name: productData.name,
      quantity: warehouseData.quantity,
      location: warehouseData.location,
    });

    const externalProductId = result.id;

    const product = await Product.create({
      ...productData,
      sellerId: userId,
      warehouseData: [{
        provider,
        warehouseId: warehouseData.warehouseId,
        sku: warehouseData.sku,
        quantity: warehouseData.quantity,
        location: warehouseData.location,
        lastUpdated: new Date(),
      }],
      status: 'pending',
      inventoryStatus: warehouseData.quantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
      webhookEvents: [
        {
          event: 'product created',
          providerId: integration._id,
          metadata: { externalProductId },
          timestamp: new Date(),
        },
      ],
    });

    await WebhookDispatcher.dispatch(
      userId,
      'product created',
      { ...product.toJSON(), externalProductId }
    );

    return NextResponse.json({
      success: true,
      data: { ...product.toJSON(), externalProductId },
    }, {
      headers: rateLimitResult?.headers,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server error' },
      { status: 500 }
    );
  }
}