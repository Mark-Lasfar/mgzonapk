import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';

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
      { success: false, error: error.message },
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
    await connectToDatabase();

    const product = await Product.create(body);

    // Dispatch webhook
    await WebhookDispatcher.dispatch(
      body.userId,
      'product.created',
      product
    );

    return NextResponse.json({
      success: true,
      data: product,
    }, {
      headers: rateLimitResult?.headers,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}