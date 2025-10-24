// /app/api/seller/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createProduct, getSellerProducts } from '@/lib/actions/product.actions';
import { getSellerByUserId, updateSellerMetrics } from '@/lib/actions/seller.actions';
import Integration from '@/lib/db/models/integration.model';
import Warehouse from '@/lib/db/models/warehouse.model';
import { Types } from 'mongoose';
import { z } from 'zod';
import { ProductInputSchema } from '@/lib/validator/product.validator';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';

// واجهة لتعريف شكل الفلاتر في GET
interface ProductFilters {
  page: number;
  limit: number;
  search?: string;
  status?: 'active' | 'draft' | 'outOfStock' | 'pending';
  category?: string;
  sortBy?: 'createdAt' | 'price' | 'stock' | 'sales';
  sortOrder?: 'asc' | 'desc';
}

// Schema لـ Multiple Products
const MultipleProductsSchema = z.array(ProductInputSchema).max(100, 'Max 100 products per request');

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized product creation', { requestId, service: 'products-api' });
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // التحقق من أن المستخدم بائع
    const sellerResponse = await getSellerByUserId(session.user.id);
    if (!sellerResponse.success || !sellerResponse.data) {
      await customLogger.error('Seller account required', { requestId, userId: session.user.id });
      return NextResponse.json({ success: false, message: 'Seller account required' }, { status: 403 });
    }

    const seller = sellerResponse.data;

    // التحقق من حالة الاشتراك
    if (seller.subscription.status !== 'active') {
      return NextResponse.json({ success: false, message: 'Active subscription required' }, { status: 403 });
    }

    const data = await req.json();
    const { 
      products, // Array من المنتجات (من XML)
      providerId, 
      productId, // Single product ID (للـ single creation)
      warehouseData,
      source = 'manual' // 'xml', 'manual', 'dropshipping'
    } = data;

    // **تحديد نوع الطلب**
    const isBulk = Array.isArray(products) && products.length > 0;
    const isSingle = !isBulk && productId;

    if (!isBulk && !isSingle) {
      return NextResponse.json(
        { success: false, message: 'Either products array or productId is required' }, 
        { status: 400 }
      );
    }

    // **التحقق من حد المنتجات للـ Bulk**
    if (isBulk) {
      const productsCount = seller.metrics.productsCount || 0;
      const productsLimit = seller.subscription.features.productsLimit;
      const requestedCount = products.length;

      if (productsCount + requestedCount > productsLimit) {
        return NextResponse.json(
          { 
            success: false, 
            message: `Product limit exceeded. Current: ${productsCount}/${productsLimit}, Requested: ${requestedCount}` 
          },
          { status: 403 }
        );
      }
    }

    // **التحقق من التكاملات**
    if (providerId) {
      const integration = await Integration.findOne({
        _id: providerId,
        type: 'dropshipping',
        isActive: true,
        enabledBySellers: new Types.ObjectId(seller._id),
      });
      if (!integration) {
        return NextResponse.json({ success: false, message: 'Invalid or inactive integration' }, { status: 400 });
      }
    }

    // **التحقق من المستودعات**
    if (warehouseData?.[0]?.warehouseId) {
      const warehouse = await Warehouse.findById(warehouseData[0].warehouseId);
      if (!warehouse) {
        return NextResponse.json(
          { success: false, message: `Invalid warehouse ID: ${warehouseData[0].warehouseId}` },
          { status: 400 }
        );
      }
      // Apply warehouse to all products in bulk
      if (isBulk) {
        products.forEach((product: any) => {
          product.warehouseData = [{ warehouseId: warehouse._id }];
        });
      } else {
        data.warehouseData[0].warehouseId = warehouse._id;
      }
    }

    // **إعداد الـ tags بناءً على الاشتراك**
    const baseTags = ['new-arrival'];
    switch (seller.subscription.plan) {
      case 'Trial':
      case 'Basic':
        baseTags.push('standard');
        break;
      case 'Pro':
        baseTags.push('featured');
        break;
      case 'VIP':
        baseTags.push('premium');
        break;
      default:
        baseTags.push('standard');
    }

    let results: any[] = [];

    if (isBulk) {
      // **BULK CREATION - Multiple Products من XML**
      await customLogger.info('Starting bulk product creation', { 
        requestId, 
        count: products.length, 
        source,
        sellerId: seller._id 
      });

      // Validate all products
      const validatedProducts = MultipleProductsSchema.parse(
        products.map((product: any) => ({
          ...product,
          tags: [...baseTags, ...(product.tags || [])],
          sellerId: seller._id.toString(),
          commission: seller.subscription.features.commission || 3,
          seller: {
            name: seller.businessName,
            email: seller.email,
            subscription: seller.subscription.plan,
          },
          source,
        }))
      );

      // Create products in parallel (with limit)
      const createPromises = validatedProducts.map((productData, index) =>
        createProduct(productData, providerId, undefined, { 
          requestId, 
          batchIndex: index,
          totalBatch: validatedProducts.length 
        }).then(result => ({ ...result, originalData: productData }))
          .catch(error => ({
            success: false,
            message: error.message,
            index,
            originalData: productData,
            code: error.code || 'CREATION_FAILED'
          }))
      );

      results = await Promise.all(createPromises);

      // **تحديث Metrics**
      const successfulCount = results.filter(r => r.success).length;
      await updateSellerMetrics(seller._id, {
        productsCount: seller.metrics.productsCount + successfulCount
      });

      await customLogger.info('Bulk creation completed', { 
        requestId, 
        successful: successfulCount, 
        failed: results.length - successfulCount,
        total: results.length 
      });

    } else {
      // **SINGLE CREATION**
      const validatedData = ProductInputSchema.parse({
        ...data,
        tags: baseTags,
        sellerId: seller._id.toString(),
        commission: seller.subscription.features.commission || 3,
        seller: {
          name: seller.businessName,
          email: seller.email,
          subscription: seller.subscription.plan,
        },
        source,
      });

      const result = await createProduct(validatedData, providerId, productId);
      results = [result];

      // Update metrics
      await updateSellerMetrics(seller._id, {
        productsCount: seller.metrics.productsCount + 1
      });
    }

    // **Detailed Response**
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: failed.length === 0,
      message: failed.length === 0 
        ? `${results.length} product(s) created successfully`
        : `${successful.length}/${results.length} products created successfully`,
      data: {
        successful,
        failed,
        summary: {
          total: results.length,
          successful: successful.length,
          failed: failed.length,
          source,
          sellerId: seller._id
        }
      },
      requestId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    const errorMessage = error instanceof z.ZodError 
      ? `Validation failed: ${error.errors[0].message}`
      : (error instanceof Error ? error.message : 'Failed to create product(s)');

    await customLogger.error('Products creation failed', { 
      requestId, 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    });

    return NextResponse.json(
      { success: false, message: errorMessage, requestId },
      { status: 400 }
    );
  }
}

// GET endpoint (بدون تغيير)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const sellerResponse = await getSellerByUserId(session.user.id);
    if (!sellerResponse.success || !sellerResponse.data) {
      return NextResponse.json({ success: false, message: 'Seller account required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') as 'active' | 'draft' | 'outOfStock' | 'pending' | undefined;
    const category = searchParams.get('category') || '';
    const sortBy = searchParams.get('sortBy') as 'createdAt' | 'price' | 'stock' | 'sales' | undefined;
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | undefined;

    const filters: ProductFilters = { page, limit, search, status, category, sortBy, sortOrder };

    const result = await getSellerProducts({
      sellerId: session.user.id,
      query: search,
      page,
      limit,
      status,
      category,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get products',
      },
      { status: 500 }
    );
  }
}