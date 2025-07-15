import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { ShipBobService } from '@/lib/services/warehouse/shipbob';
import { FourPXService } from '@/lib/services/warehouse/fourpx';
import { logger } from '@/lib/services/logging';
import Product from '@/lib/db/models/product.model';
import Seller from '@/lib/db/models/seller.model';
import { z } from 'zod';
import { getTranslations } from 'next-intl/server';

// تعريف مخطط التحقق من البيانات لتحديث المخزون
const InventoryUpdateSchema = z.object({
  provider: z.enum(['ShipBob', '4PX']),
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().min(0, 'Quantity must be non-negative'),
  sku: z.string().min(1, 'SKU is required'),
});

// تهيئة خدمات المستودعات
const warehouseProviders: Record<string, ShipBobService | FourPXService> = {
  ShipBob: new ShipBobService({
    apiKey: process.env.SHIPBOB_API_KEY || '',
    apiUrl: process.env.SHIPBOB_API_URL || '',
  }),
  '4PX': new FourPXService({
    apiKey: process.env.FOURPX_API_KEY || '',
    apiUrl: process.env.FOURPX_API_URL || '',
  }),
};

// دالة GET لجلب بيانات المستودعات
export async function GET(req: NextRequest, { params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'api' });
  try {
    const session = await auth();
    if (!session?.user?.id || !['Admin', 'Seller'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // التحقق من حالة التحقق للسيلر
    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller || seller.verification.status !== 'verified') {
      return NextResponse.json(
        { success: false, message: t('errors.sellerVerificationPending') },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');

    if (!provider || !(provider in warehouseProviders)) {
      return NextResponse.json(
        { success: false, message: t('errors.invalidProvider', { provider }) },
        { status: 400 }
      );
    }

    // التحقق من وجود API key
    if (!process.env[`${provider.toUpperCase()}_API_KEY`]) {
      logger.error('Missing API key for provider', { provider });
      return NextResponse.json(
        { success: false, message: t('errors.missingApiKey') },
        { status: 500 }
      );
    }

    const warehouses = await warehouseProviders[provider].getWarehouses();
    logger.info('Warehouses retrieved', {
      provider,
      count: warehouses.length,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: warehouses });
  } catch (error) {
    logger.error('Failed to retrieve warehouses', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: req.url,
    });
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : t('errors.internalServerError'),
      },
      { status: 500 }
    );
  }
}

// دالة POST لتحديث المخزون
export async function POST(req: NextRequest, { params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'api' });
  try {
    const session = await auth();
    if (!session?.user?.id || !['Admin', 'Seller'].includes(session.user.role)) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // التحقق من حالة التحقق للسيلر
    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller || seller.verification.status !== 'verified') {
      return NextResponse.json(
        { success: false, message: t('errors.sellerVerificationPending') },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = InventoryUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.message },
        { status: 400 }
      );
    }

    const { provider, productId, quantity, sku } = parsed.data;

    // التحقق من وجود API key
    if (!process.env[`${provider.toUpperCase()}_API_KEY`]) {
      logger.error('Missing API key for provider', { provider });
      return NextResponse.json(
        { success: false, message: t('errors.missingApiKey') },
        { status: 500 }
      );
    }

    // تحديث مخزون المستودع
    await warehouseProviders[provider].updateInventory(sku, quantity);

    // تحديث المنتج في قاعدة البيانات
    const product = await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          'warehouseData.$[elem].quantity': quantity,
          'warehouseData.$[elem].lastUpdated': new Date(),
          'warehouseData.$[elem].updatedBy': session.user.id,
          countInStock: quantity,
          updatedAt: new Date(),
        },
      },
      {
        arrayFilters: [{ 'elem.sku': sku }],
        new: true,
      }
    );

    if (!product) {
      return NextResponse.json(
        { success: false, message: t('errors.productNotFound') },
        { status: 404 }
      );
    }

    logger.info('Warehouse inventory updated', {
      provider,
      productId,
      quantity,
      sku,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: t('messages.inventoryUpdated'),
      data: product,
    });
  } catch (error) {
    logger.error('Failed to update warehouse inventory', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: req.url,
    });
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : t('errors.internalServerError'),
      },
      { status: 500 }
    );
  }
}