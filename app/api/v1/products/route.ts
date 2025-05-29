import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { ShipBobService } from '@/lib/api/integrations/warehouses/shipbob/service';
import { FourPXService } from '@/lib/api/integrations/warehouses/4px/service';

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

    await connectToDatabase();

    let externalProductId: string | null = null;
    if (provider === 'shipbob') {
      const shipbobService = new ShipBobService({
        apiKey: process.env.SHIPBOB_API_KEY!,
        apiUrl: process.env.SHIPBOB_API_URL!,
      });
      const result = await shipbobService.createProduct({
        sku: warehouseData.sku,
        name: productData.name,
        quantity: warehouseData.quantity,
        location: warehouseData.location,
      });
      externalProductId = result.id;
    } else if (provider === '4px') {
      const fourPXService = new FourPXService({
        apiKey: process.env.FOURPX_API_KEY!,
        apiSecret: process.env.FOURPX_API_SECRET!,
        apiUrl: process.env.FOURPX_API_URL!,
      });
      const result = await fourPXService.createProduct({
        sku: warehouseData.sku,
        name: productData.name,
        quantity: warehouseData.quantity,
        location: warehouseData.location,
      });
      externalProductId = result.id;
    }

    const product = await Product.create({
      ...productData,
      sellerId: userId,
      warehouseData: [{
        ...warehouseData,
        provider,
        warehouseId: warehouseData.warehouseId,
        lastUpdated: new Date(),
      }],
      status: 'pending',
      inventoryStatus: warehouseData.quantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    });

    // Dispatch webhook
    await WebhookDispatcher.dispatch(
      userId,
      'product.created',
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