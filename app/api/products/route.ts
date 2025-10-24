import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createProduct, getSellerProducts } from '@/lib/actions/product.actions';
import { getSellerByUserId } from '@/lib/actions/seller.actions';
import { getSetting } from '@/lib/actions/setting.actions';
import Integration from '@/lib/db/models/integration.model';
import Warehouse from '@/lib/db/models/warehouse.model';
import Product from '@/lib/db/models/product.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { Types } from 'mongoose';
import { z } from 'zod';
import { ProductInputSchema } from '@/lib/validator/product.validator';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { connectToDatabase } from '@/lib/db';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import { getTranslations } from 'next-intl/server';

// دالة لإرسال اللوج إلى /api/log
async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, meta }),
    });
  } catch (err) {
    console.error('Failed to send log:', err);
  }
}

// واجهة لتعريف شكل الفلاتر
interface ProductFilters {
  page: number;
  limit: number;
  search?: string;
  status?: 'active' | 'draft' | 'outOfStock' | 'pending';
  category?: string;
  sortBy?: 'createdAt' | 'price' | 'stock' | 'sales';
  sortOrder?: 'asc' | 'desc';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') as 'active' | 'draft' | 'outOfStock' | 'pending' | undefined;
  const category = searchParams.get('category') || '';
  const sortBy = searchParams.get('sortBy') as 'createdAt' | 'price' | 'stock' | 'sales' | undefined;
  const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | undefined;
  const sort = searchParams.get('sort') || '-createdAt';
  const slug = searchParams.get('slug') || '';
  const action = searchParams.get('action') || '';

  const t = await getTranslations('products');

  // التحقق من مفتاح API (للـ external API)
  const apiKeyError = await validateApiKey(req);
  if (apiKeyError) {
    const rateLimitResult = await rateLimit(req);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

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
        .limit(limit)
        .lean();

      await sendLog('info', t('products fetched'), { total, page, limit });
      return NextResponse.json(
        {
          success: true,
          data: {
            items: products,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
        { headers: rateLimitResult?.headers }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('server error');
      await sendLog('error', t('failed to fetch products'), { error: errorMessage });
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  // التحقق من المستخدم (للـ internal API)
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 401 });
  }

  const sellerResponse = await getSellerByUserId(session.user.id);
  if (!sellerResponse.success || !sellerResponse.data) {
    return NextResponse.json({ success: false, message: t('Seller account required') }, { status: 403 });
  }

  // التعامل مع الدوال الجديدة بناءً على الـ action
  try {
    await connectToDatabase();

    if (action === 'getProductBySlug' && slug) {
      const product = await Product.findOne({
        slug,
        isPublished: true,
        status: 'active',
      }).lean();
      if (!product) {
        await sendLog('error', t('Product not found'), { slug });
        return NextResponse.json({ success: false, message: t('Product not found') }, { status: 404 });
      }
      await sendLog('info', t('Product fetched by slug'), { slug });
      return NextResponse.json({ success: true, data: product });
    }

    if (action === 'getRelatedProducts' && category) {
      const productId = searchParams.get('productId') || undefined;
      const query: any = {
        category,
        isPublished: true,
        status: 'active',
        countInStock: { $gt: 0 },
      };
      if (productId) {
        query._id = { $ne: productId };
      }
      const products = await Product.find(query)
        .sort({ 'metrics.sales': -1 })
        .limit(limit)
        .select({
          name: 1,
          images: 1,
          slug: 1,
          price: 1,
          finalPrice: 1,
        })
        .lean();
      await sendLog('info', t('Related products fetched'), { category, limit });
      return NextResponse.json({ success: true, data: products });
    }

    if (action === 'getRelatedProductsByCategory' && category && searchParams.get('productId')) {
      const productId = searchParams.get('productId')!;
      const {
        common: { pageSize },
      } = await getSetting();
      const effectiveLimit = limit || pageSize;
      const skip = (page - 1) * effectiveLimit;
      const conditions = {
        isPublished: true,
        category,
        _id: { $ne: productId },
        status: 'active',
        countInStock: { $gt: 0 },
      };
      const [products, totalProducts] = await Promise.all([
        Product.find(conditions)
          .sort({ 'metrics.sales': -1 })
          .skip(skip)
          .limit(effectiveLimit)
          .lean(),
        Product.countDocuments(conditions),
      ]);
      await sendLog('info', t('Related products by category fetched'), { category, productId, page, limit });
      return NextResponse.json({
        success: true,
        data: {
          data: products,
          totalPages: Math.ceil(totalProducts / effectiveLimit),
        },
      });
    }

    if (action === 'getAllTags') {
      const tags = await Product.aggregate([
        { $match: { isPublished: true, status: 'active' } },
        { $unwind: '$tags' },
        { $group: { _id: null, uniqueTags: { $addToSet: '$tags' } } },
        { $project: { _id: 0, uniqueTags: 1 } },
      ]);
      const formattedTags = tags[0]?.uniqueTags
        .sort((a: string, b: string) => a.localeCompare(b))
        .map((tag: string) =>
          tag
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        ) || [];
      await sendLog('info', t('Tags fetched'), { totalTags: formattedTags.length });
      return NextResponse.json({ success: true, data: formattedTags });
    }

    if (action === 'getAllCategories') {
      const categories = await Product.distinct('category', {
        isPublished: true,
        status: 'active',
      });
      await sendLog('info', t('Categories fetched'), { totalCategories: categories.length });
      return NextResponse.json({ success: true, data: categories });
    }

    // منطق getSellerProducts (الأصلي)
    const filters: ProductFilters = { page, limit, search, status, category, sortBy, sortOrder };
    const queryFilter: any = {};

    if (session.user.role === 'SELLER') {
      if (mongoose.Types.ObjectId.isValid(session.user.id)) {
        queryFilter.sellerId = new mongoose.Types.ObjectId(session.user.id);
      } else {
        console.warn('Invalid seller ID:', session.user.id);
      }
    }
    if (search) {
      queryFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [products, totalProducts] = await Promise.all([
      Product.find(queryFilter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({
          name: 1,
          slug: 1,
          price: 1,
          category: 1,
          countInStock: 1,
          isPublished: 1,
          metrics: 1,
          status: 1,
          warehouseData: 1,
        })
        .lean(),
      Product.countDocuments(queryFilter),
    ]);
    await sendLog('info', t('Seller products fetched'), {
      sellerId: session.user.id,
      total: totalProducts,
      page,
      limit,
    });
    return NextResponse.json({
      success: true,
      data: {
        products,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
        from: skip + 1,
        to: skip + products.length,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to get products');
    await sendLog('error', t('Failed to get products'), { error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, provider, warehouseData, providerId, productId, ...productData } = body;

  const t = await getTranslations('products');

  // التحقق من مفتاح API (للـ external API)
  const apiKeyError = await validateApiKey(req);
  if (apiKeyError) {
    const rateLimitResult = await rateLimit(req);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    if (!provider || !warehouseData) {
      await sendLog('error', t('Provider and warehouse data are required'), { provider, warehouseData });
      return NextResponse.json(
        { success: false, error: t('Provider and warehouse data are required') },
        { status: 400 }
      );
    }

    try {
      await connectToDatabase();

      const integration = await Integration.findOne({ providerName: provider, type: 'warehouse' });
      if (!integration || !integration.isActive) {
        await sendLog('error', t('Integration not found or inactive'), { provider });
        return NextResponse.json(
          { success: false, error: t('Integration not found or inactive') },
          { status: 404 }
        );
      }

      const sellerIntegration = await SellerIntegration.findOne({
        sellerId: userId,
        integrationId: integration._id,
        isActive: true,
      });
      if (!sellerIntegration) {
        await sendLog('error', t('Seller integration not found'), { userId, integrationId: integration._id });
        return NextResponse.json(
          { success: false, error: t('Seller integration not found') },
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
        warehouseData: [
          {
            provider,
            warehouseId: warehouseData.warehouseId,
            sku: warehouseData.sku,
            quantity: warehouseData.quantity,
            location: warehouseData.location,
            lastUpdated: new Date(),
          },
        ],
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

      await WebhookDispatcher.dispatch(userId, 'product created', {
        ...product.toJSON(),
        externalProductId,
      });

      await sendLog('info', t('Product created via external API'), { userId, externalProductId });
      return NextResponse.json(
        { success: true, data: { ...product.toJSON(), externalProductId } },
        { headers: rateLimitResult?.headers }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('Server error');
      await sendLog('error', t('Failed to create product'), { error: errorMessage });
      return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  // منطق الـ internal API (للبائعين)
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await sendLog('error', t('Unauthorized'), { userId });
      return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 401 });
    }

    const sellerResponse = await getSellerByUserId(session.user.id);
    if (!sellerResponse.success || !sellerResponse.data) {
      await sendLog('error', t('Seller account required'), { userId: session.user.id });
      return NextResponse.json({ success: false, message: t('Seller account required') }, { status: 403 });
    }

    const seller = sellerResponse.data;

    if (seller.subscription.status !== 'active') {
      await sendLog('error', t('Active subscription required'), { sellerId: seller._id });
      return NextResponse.json({ success: false, message: t('Active subscription required') }, { status: 403 });
    }

    const productsCount = seller.metrics.productsCount || 0;
    const productsLimit = seller.subscription.features.productsLimit;
    if (productsCount >= productsLimit) {
      await sendLog('error', t('Product limit reached'), { sellerId: seller._id, productsLimit });
      return NextResponse.json(
        { success: false, message: t('Product limit (%s) reached for your subscription plan', { productsLimit }) },
        { status: 403 }
      );
    }

    if (providerId) {
      const integration = await Integration.findOne({
        _id: providerId,
        type: 'dropshipping',
        isActive: true,
        enabledBySellers: new Types.ObjectId(seller._id),
      });
      if (!integration) {
        await sendLog('error', t('Invalid or inactive integration'), { providerId });
        return NextResponse.json(
          { success: false, message: t('Invalid or inactive integration') },
          { status: 400 }
        );
      }
    }

    const warehouseId = warehouseData?.[0]?.warehouseId;
    if (warehouseId) {
      const warehouse = await Warehouse.findById(warehouseId);
      if (!warehouse) {
        await sendLog('error', t('Invalid warehouse ID'), { warehouseId });
        return NextResponse.json(
          { success: false, message: t('Invalid warehouse ID: %s', { warehouseId }) },
          { status: 400 }
        );
      }
      warehouseData[0].warehouseId = warehouse._id;
    }

    let tags = ['new-arrival'];
    switch (seller.subscription.plan) {
      case 'Trial':
      case 'Basic':
        tags.push('standard');
        break;
      case 'Pro':
        tags.push('featured');
        break;
      case 'VIP':
        tags.push('premium');
        break;
      default:
        tags.push('standard');
    }

    const productData = {
      ...productData,
      tags,
      sellerId: seller._id,
      commission: seller.subscription.features.commission || 3,
      seller: {
        name: seller.businessName,
        email: seller.email,
        subscription: seller.subscription.plan,
      },
    };

    const validatedData = ProductInputSchema.parse(productData);
    const result = await createProduct(validatedData, providerId, productId);

    if (!result.success) {
      await sendLog('error', t('Failed to create product'), { message: result.message, code: result.code });
      return NextResponse.json(
        { success: false, message: result.message, code: result.code },
        { status: 400 }
      );
    }

    await sendLog('info', t('Product created'), { sellerId: seller._id, productId });
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Failed to create product');
    await sendLog('error', t('Failed to create product'), { error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}