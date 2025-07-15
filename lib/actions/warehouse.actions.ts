
'use server';

import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
// import Order from '@/lib/db/models/order.model';
import Warehouse from '@/lib/db/models/warehouse.model';
import Seller from '@/lib/db/models/seller.model';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { revalidatePath } from 'next/cache';
import mongoose from 'mongoose';
import { auth } from '@/auth';
import { WarehouseStockSchema } from '@/lib/schemas/warehouse.schema';
import { getTranslations } from 'next-intl/server';
import { logger } from '@/lib/api/services/logging';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { z } from 'zod';

export interface CreateWarehouseParams {
  name: string;
  code: string;
  integrationId: string;
  location: string;
  autoSync?: boolean;
  syncInterval?: number;
}

export interface UpdateWarehouseParams {
  name?: string;
  code?: string;
  location?: string;
  isActive?: boolean;
  autoSync?: boolean;
  syncInterval?: number;
  webhookUrl?: string;
}

export interface UpdateWarehouseStockParams {
  productId: string;
  warehouseId: string;
  quantity: number;
  sku: string;
  location?: string;
  minimumStock: number;
  reorderPoint: number;
  colors?: Array<{
    name: string;
    quantity: number;
    inStock: boolean;
    sizes: Array<{
      name: string;
      quantity: number;
      inStock: boolean;
    }>;
  }>;
}

export async function getWarehouses(locale: string = 'en') {
  const t = await getTranslations({ locale, namespace: 'api' });
  const sessionAuth = await auth();

  if (!sessionAuth?.user?.id) {
    throw new Error(t('errors.unauthenticated'));
  }

  try {
    await connectToDatabase();
    const warehouses = await Warehouse.find({ createdBy: sessionAuth.user.id }).lean();
    return { success: true, data: warehouses };
  } catch (error) {
    logger.error('Fetch warehouses error', { error });
    throw new Error(t('errors.serverError'));
  }
}

export async function createWarehouse(params: CreateWarehouseParams, locale: string = 'en') {
  const t = await getTranslations({ locale, namespace: 'api' });
  const sessionAuth = await auth();

  if (!sessionAuth?.user?.id) {
    throw new Error(t('errors.unauthenticated'));
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await connectToDatabase();

    const integration = await Integration.findById(params.integrationId).session(session);
    if (!integration || integration.type !== 'warehouse') {
      throw new Error(t('errors.invalid_integration'));
    }

    const warehouse = new Warehouse({
      ...params,
      isActive: true,
      settings: {
        autoSync: params.autoSync ?? true,
        syncInterval: params.syncInterval ?? 3600000,
      },
      createdBy: sessionAuth.user.id,
      updatedBy: sessionAuth.user.id,
    });

    await warehouse.save({ session });

    await SellerIntegration.create(
      [
        {
          sellerId: sessionAuth.user.id,
          integrationId: integration._id,
          providerName: integration.providerName,
          sandbox: false,
          isActive: true,
          status: 'connected',
          connectedBy: sessionAuth.user.id,
          connectedByRole: 'seller',
          connectionType: 'manual',
          history: [{ event: 'connected', date: new Date() }],
        },
      ],
      { session }
    );

    await WebhookDispatcher.dispatch(sessionAuth.user.id, 'warehouse.created', {
      warehouseId: warehouse._id,
      integrationId: integration._id,
    });

    await session.commitTransaction();
    revalidatePath('/admin/warehouses');
    return { success: true, message: t('warehouseCreated'), data: warehouse };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Create warehouse error', { error });
    throw new Error(t('errors.serverError'));
  } finally {
    session.endSession();
  }
}

export async function updateWarehouse(
  id: string,
  params: UpdateWarehouseParams,
  locale: string = 'en'
) {
  const t = await getTranslations({ locale, namespace: 'api' });
  const sessionAuth = await auth();

  if (!sessionAuth?.user?.id) {
    throw new Error(t('errors.unauthenticated'));
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await connectToDatabase();

    const warehouse = await Warehouse.findById(id).session(session);
    if (!warehouse) {
      throw new Error(t('errors.warehouseNotFound'));
    }

    Object.assign(warehouse, {
      ...params,
      settings: {
        ...(warehouse.settings || {}),
        autoSync: params.autoSync ?? warehouse.settings?.autoSync,
        syncInterval: params.syncInterval ?? warehouse.settings?.syncInterval,
        webhookUrl: params.webhookUrl ?? warehouse.settings?.webhookUrl,
      },
      updatedBy: sessionAuth.user.id,
      updatedAt: new Date(),
    });

    await warehouse.save({ session });

    await WebhookDispatcher.dispatch(sessionAuth.user.id, 'warehouse.updated', {
      warehouseId: warehouse._id,
    });

    await session.commitTransaction();
    revalidatePath('/admin/warehouses');
    return { success: true, message: t('warehouseUpdated'), data: warehouse };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Update warehouse error', { error });
    throw new Error(t('errors.serverError'));
  } finally {
    session.endSession();
  }
}

export async function updateWarehouseStock(params: UpdateWarehouseStockParams) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const sessionAuth = await auth();
    if (!sessionAuth?.user?.id) {
      throw new Error('Unauthorized');
    }

    await connectToDatabase();

    const validatedData = WarehouseStockSchema.parse(params);
    const warehouse = await Warehouse.findById(validatedData.warehouseId).session(session);
    if (!warehouse) {
      throw new Error('Warehouse not found');
    }

    const product = await Product.findById(validatedData.productId).session(session);
    if (!product) {
      throw new Error('Product not found');
    }

    const integration = await Integration.findById(warehouse.integrationId).session(session);
    if (!integration) {
      throw new Error('Integration not found');
    }

await fetch(`${integration.credentials.get('apiUrl')}/inventory/${validatedData.productId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${integration.credentials.get('apiKey')}`,
  },
  body: JSON.stringify({
    // بيانات التحديث
    quantity: validatedData.quantity,
    price: validatedData.price,
  }),
});


    warehouse.products.set(validatedData.productId, {
      productId: validatedData.productId,
      sku: validatedData.sku,
      name: product.name,
      quantity: validatedData.quantity,
      location: validatedData.location,
      lastSync: new Date(),
      lastUpdated: new Date(),
      updatedBy: sessionAuth.user.id,
    });

    await warehouse.save({ session });

    const warehouseIndex = product.warehouseData.findIndex(
      (wh: any) => wh.warehouseId === validatedData.warehouseId
    );

    if (warehouseIndex === -1) {
      product.warehouseData.push(validatedData);
    } else {
      product.warehouseData[warehouseIndex] = validatedData;
    }

    product.countInStock = product.warehouseData.reduce((sum: number, wh: any) => sum + wh.quantity, 0);
    product.inventoryStatus =
      product.countInStock === 0
        ? 'OUT_OF_STOCK'
        : product.countInStock <= validatedData.minimumStock
        ? 'LOW_STOCK'
        : 'IN_STOCK';

    await product.save({ session });

    await WebhookDispatcher.dispatch(sessionAuth.user.id, 'warehouse.stock.updated', {
      warehouseId: validatedData.warehouseId,
      productId: validatedData.productId,
      quantity: validatedData.quantity,
    });

    await session.commitTransaction();
    revalidatePath('/admin/products');
    revalidatePath('/seller/dashboard/products');
    return { success: true, message: 'Stock updated successfully' };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Stock update error', { error });
    throw error;
  } finally {
    session.endSession();
  }
}