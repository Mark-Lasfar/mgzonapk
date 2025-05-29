'use server'

import { connectToDatabase } from '@/lib/db';
import { ShipBobService } from '../services/warehouse/shipbob';
import { FourPXService } from '../services/warehouse/fourpx';
import { WarehouseProvider } from '../services/warehouse/types';
import Product from '../db/models/product.model';
import Order from '../db/models/order.model';
import { formatError } from '../utils';
import { revalidatePath } from 'next/cache';
import mongoose from 'mongoose';
import { auth } from '@/auth';
import { z } from 'zod';
import { logger } from '@/lib/services/logging';

// Warehouse Stock Schema
const WarehouseStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  provider: z.enum(['ShipBob', '4PX']),
  quantity: z.number().min(0, 'Quantity must be non-negative'),
  sku: z.string().min(1, 'SKU is required'),
  location: z.string().min(1, 'Location is required'),
  minimumStock: z.number().min(0, 'Minimum stock must be non-negative'),
  reorderPoint: z.number().min(0, 'Reorder point must be non-negative'),
  colors: z
    .array(
      z.object({
        name: z.string().min(1, 'Color name is required'),
        hex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
        quantity: z.number().min(0),
        inStock: z.boolean(),
        sizes: z.array(
          z.object({
            name: z.string().min(1, 'Size name is required'),
            quantity: z.number().min(0),
            inStock: z.boolean(),
          })
        ),
      })
    )
    .optional(),
  lastUpdated: z.date().optional(),
  updatedBy: z.string().optional(),
});

const SyncWithWarehouseSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  provider: z.enum(['ShipBob', '4PX']),
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().min(0, 'Quantity must be non-negative'),
  colors: z
    .array(
      z.object({
        name: z.string().min(1, 'Color name is required'),
        hex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
        quantity: z.number().min(0),
        inStock: z.boolean(),
        sizes: z.array(
          z.object({
            name: z.string().min(1, 'Size name is required'),
            quantity: z.number().min(0),
            inStock: z.boolean(),
          })
        ),
      })
    )
    .optional(),
});

// Warehouse Providers Configuration
const warehouseProviders: Record<string, ShipBobService | FourPXService> = {
  ShipBob: new ShipBobService({
    apiKey: process.env.SHIPBOB_API_KEY!,
    apiUrl: process.env.SHIPBOB_API_URL!,
  }),
  '4PX': new FourPXService({
    apiKey: process.env.FOURPX_API_KEY!,
    apiUrl: process.env.FOURPX_API_URL!,
  }),
};

// Types
export interface UpdateWarehouseStockParams {
  productId: string;
  warehouseId: string;
  provider: 'ShipBob' | '4PX';
  quantity: number;
  sku: string;
  location: string;
  minimumStock: number;
  reorderPoint: number;
  colors?: Array<{
    name: string;
    hex: string;
    quantity: number;
    inStock: boolean;
    sizes: Array<{
      name: string;
      quantity: number;
      inStock: boolean;
    }>;
  }>;
  updatedBy?: string;
}

export interface SyncWithWarehouseParams {
  productId: string;
  warehouseId: string;
  provider: 'ShipBob' | '4PX';
  sku: string;
  quantity: number;
  colors?: Array<{
    name: string;
    hex: string;
    quantity: number;
    inStock: boolean;
    sizes: Array<{
      name: string;
      quantity: number;
      inStock: boolean;
    }>;
  }>;
}

/**
 * Updates the stock level for a product in a specific warehouse.
 */
export async function updateWarehouseStock(params: UpdateWarehouseStockParams) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const authSession = await auth();
    if (!authSession?.user?.id || !['Admin', 'Seller'].includes(authSession.user.role)) {
      throw new Error('Unauthorized');
    }

    const currentDate = new Date();
    const currentUser = authSession.user.id;

    logger.info('Updating stock for product', { productId: params.productId, userId: currentUser });

    await connectToDatabase();

    const validatedData = WarehouseStockSchema.parse({
      ...params,
      lastUpdated: currentDate,
      updatedBy: params.updatedBy || currentUser,
    });

    const product = await Product.findById(validatedData.productId).session(session);
    if (!product) throw new Error('Product not found');

    const provider = warehouseProviders[validatedData.provider];
    if (!provider) throw new Error(`Invalid warehouse provider: ${validatedData.provider}`);

    await provider.updateInventory(validatedData.sku, validatedData.quantity);

    const warehouseIndex = product.warehouseData.findIndex(
      (wh: any) => wh.warehouseId === validatedData.warehouseId
    );

    if (warehouseIndex === -1) {
      product.warehouseData.push(validatedData);
    } else {
      product.warehouseData[warehouseIndex] = {
        ...product.warehouseData[warehouseIndex],
        ...validatedData,
      };
    }

    const totalStock = product.warehouseData.reduce(
      (sum: number, wh: any) => sum + (wh.quantity || 0),
      0
    );

    const inventoryStatus =
      totalStock === 0
        ? 'OUT_OF_STOCK'
        : totalStock <= Math.min(...product.warehouseData.map((wh: any) => wh.minimumStock || 0))
          ? 'LOW_STOCK'
          : 'IN_STOCK';

    await Product.findByIdAndUpdate(
      validatedData.productId,
      {
        $set: {
          warehouseData: product.warehouseData,
          countInStock: totalStock,
          inventoryStatus,
          updatedAt: currentDate,
          updatedBy: validatedData.updatedBy || currentUser,
        },
      },
      { session }
    );

    await session.commitTransaction();

    revalidatePath('/admin/products');
    revalidatePath('/seller/dashboard/products');
    revalidatePath(`/product/${product.slug}`);

    return {
      success: true,
      message: 'Stock updated successfully',
      data: { totalStock, status: inventoryStatus },
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Stock update error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId: params.productId,
    });
    return {
      success: false,
      message: formatError(error),
    };
  } finally {
    session.endSession();
  }
}

/**
 * Syncs product inventory with external warehouse provider during product creation/update.
 */
export async function syncWithWarehouse(params: SyncWithWarehouseParams) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const authSession = await auth();
    if (!authSession?.user?.id || !['Admin', 'Seller'].includes(authSession.user.role)) {
      throw new Error('Unauthorized');
    }

    const currentDate = new Date();
    const currentUser = authSession.user.id;

    logger.info('Syncing warehouse for product', { productId: params.productId, userId: currentUser });

    await connectToDatabase();

    const validatedData = SyncWithWarehouseSchema.parse(params);

    const product = await Product.findById(validatedData.productId).session(session);
    if (!product) throw new Error('Product not found');

    const provider = warehouseProviders[validatedData.provider];
    if (!provider) throw new Error(`Invalid warehouse provider: ${validatedData.provider}`);

    // Update warehouse inventory
    await provider.updateInventory(validatedData.sku, validatedData.quantity);

    // Update product warehouseData
    const warehouseIndex = product.warehouseData.findIndex(
      (wh: any) => wh.warehouseId === validatedData.warehouseId
    );

    const warehouseData = {
      warehouseId: validatedData.warehouseId,
      provider: validatedData.provider,
      sku: validatedData.sku,
      quantity: validatedData.quantity,
      location: product.warehouseData[warehouseIndex]?.location || 'Unknown',
      minimumStock: product.warehouseData[warehouseIndex]?.minimumStock || 5,
      reorderPoint: product.warehouseData[warehouseIndex]?.reorderPoint || 10,
      colors: validatedData.colors || [],
      lastUpdated: currentDate,
      updatedBy: currentUser,
    };

    if (warehouseIndex === -1) {
      product.warehouseData.push(warehouseData);
    } else {
      product.warehouseData[warehouseIndex] = warehouseData;
    }

    const totalStock = product.warehouseData.reduce(
      (sum: number, wh: any) => sum + (wh.quantity || 0),
      0
    );

    const inventoryStatus =
      totalStock === 0
        ? 'OUT_OF_STOCK'
        : totalStock <= Math.min(...product.warehouseData.map((wh: any) => wh.minimumStock || 0))
          ? 'LOW_STOCK'
          : 'IN_STOCK';

    await Product.findByIdAndUpdate(
      validatedData.productId,
      {
        $set: {
          warehouseData: product.warehouseData,
          countInStock: totalStock,
          inventoryStatus,
          updatedAt: currentDate,
          updatedBy: currentUser,
        },
      },
      { session }
    );

    await session.commitTransaction();

    revalidatePath('/admin/products');
    revalidatePath('/seller/dashboard/products');
    revalidatePath(`/product/${product.slug}`);

    return {
      success: true,
      message: 'Warehouse synced successfully',
      data: { totalStock, status: inventoryStatus },
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Warehouse sync error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId: params.productId,
    });
    return {
      success: false,
      message: formatError(error),
    };
  } finally {
    session.endSession();
  }
}

/**
 * Syncs product inventory with external warehouse provider.
 */
export async function syncProductInventory(productId: string) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const authSession = await auth();
    if (!authSession?.user?.id || !['Admin', 'Seller'].includes(authSession.user.role)) {
      throw new Error('Unauthorized');
    }

    const currentDate = new Date();
    const currentUser = authSession.user.id;

    logger.info('Syncing inventory for product', { productId, userId: currentUser });

    await connectToDatabase();

    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error('Product not found');

    const warehouseDataUpdates = await Promise.all(
      product.warehouseData.map(async (wh: any) => {
        const provider = warehouseProviders[wh.provider];
        if (!provider) throw new Error(`Invalid warehouse provider: ${wh.provider}`);

        const inventory = await provider.getInventory(wh.sku);
        return {
          ...wh,
          quantity: inventory.quantity,
          location: inventory.location || wh.location,
          lastSync: currentDate,
          lastUpdated: currentDate,
          updatedBy: currentUser,
        };
      })
    );

    const totalStock = warehouseDataUpdates.reduce(
      (sum: number, wh: any) => sum + (wh.quantity || 0),
      0
    );

    const inventoryStatus =
      totalStock === 0
        ? 'OUT_OF_STOCK'
        : totalStock <= Math.min(...warehouseDataUpdates.map((wh: any) => wh.minimumStock || 0))
          ? 'LOW_STOCK'
          : 'IN_STOCK';

    await Product.findByIdAndUpdate(
      productId,
      {
        $set: {
          warehouseData: warehouseDataUpdates,
          countInStock: totalStock,
          inventoryStatus,
          updatedAt: currentDate,
          updatedBy: currentUser,
        },
      },
      { session }
    );

    await session.commitTransaction();

    revalidatePath('/admin/products');
    revalidatePath('/seller/dashboard/products');
    revalidatePath(`/product/${product.slug}`);

    return {
      success: true,
      data: {
        totalStock,
        inventoryStatus,
        lastSync: currentDate,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Inventory sync error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      productId,
    });
    return {
      success: false,
      message: formatError(error),
    };
  } finally {
    session.endSession();
  }
}

/**
 * Creates shipments for an order using appropriate warehouse providers.
 */
export async function createShipment(orderId: string) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const authSession = await auth();
    if (!authSession?.user?.id || !['Admin'].includes(authSession.user.role)) {
      throw new Error('Unauthorized');
    }

    const currentDate = new Date();
    const currentUser = authSession.user.id;

    logger.info('Creating shipment for order', { orderId, userId: currentUser });

    await connectToDatabase();

    const order = await Order.findById(orderId)
      .populate('items.product')
      .session(session);

    if (!order) throw new Error('Order not found');

    // Validate stock availability
    for (const item of order.items) {
      const product = item.product;
      const totalAvailable = product.warehouseData.reduce(
        (sum: number, wh: any) => sum + (wh.quantity || 0),
        0
      );
      if (totalAvailable < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name} (SKU: ${product.warehouseData[0]?.sku})`);
      }
    }

    const itemsByProvider: { [key: string]: any } = {};
    for (const item of order.items) {
      const product = item.product;
      const warehouse = product.warehouseData[0]; // Use first warehouse for simplicity
      const provider = warehouse.provider;

      if (!itemsByProvider[provider]) {
        itemsByProvider[provider] = {
          orderId,
          items: [],
          shippingAddress: {
            name: order.shippingAddress.fullName,
            street: order.shippingAddress.street,
            city: order.shippingAddress.city,
            state: order.shippingAddress.province,
            country: order.shippingAddress.country,
            postalCode: order.shippingAddress.postalCode,
            phone: order.shippingAddress.phone,
          },
        };
      }

      itemsByProvider[provider].items.push({
        sku: warehouse.sku,
        quantity: item.quantity,
      });
    }

    const shipments = await Promise.all(
      Object.entries(itemsByProvider).map(async ([provider, request]) => {
        const warehouseProvider = warehouseProviders[provider];
        if (!warehouseProvider) throw new Error(`Invalid warehouse provider: ${provider}`);

        const shipment = await warehouseProvider.createShipment(request);
        return {
          provider,
          trackingId: shipment.trackingId,
          createdAt: currentDate,
          createdBy: currentUser,
          status: 'pending',
        };
      })
    );

    // Update product stock
    for (const item of order.items) {
      const product = item.product;
      const warehouseIndex = product.warehouseData.findIndex(
        (wh: any) => wh.sku === item.product.warehouseData[0].sku
      );
      if (warehouseIndex !== -1) {
        product.warehouseData[warehouseIndex].quantity -= item.quantity;
        product.warehouseData[warehouseIndex].lastUpdated = currentDate;
        product.warehouseData[warehouseIndex].updatedBy = currentUser;
      }

      const totalStock = product.warehouseData.reduce(
        (sum: number, wh: any) => sum + (wh.quantity || 0),
        0
      );

      const inventoryStatus =
        totalStock === 0
          ? 'OUT_OF_STOCK'
          : totalStock <= Math.min(...product.warehouseData.map((wh: any) => wh.minimumStock || 0))
            ? 'LOW_STOCK'
            : 'IN_STOCK';

      await Product.findByIdAndUpdate(
        product._id,
        {
          $set: {
            warehouseData: product.warehouseData,
            countInStock: totalStock,
            inventoryStatus,
            updatedAt: currentDate,
            updatedBy: currentUser,
          },
        },
        { session }
      );

      // Sync updated stock with warehouse provider
      await warehouseProviders[product.warehouseData[0].provider].updateInventory(
        product.warehouseData[0].sku,
        product.warehouseData[0].quantity
      );
    }

    order.shipments = shipments;
    order.status = 'processing';
    order.updatedAt = currentDate;
    order.updatedBy = currentUser;
    await order.save({ session });

    await session.commitTransaction();

    revalidatePath('/admin/orders');
    revalidatePath('/seller/dashboard/orders');

    return {
      success: true,
      message: 'Shipments created successfully',
      data: shipments,
    };
  } catch (error) {
    await session.abortTransaction();
    logger.error('Shipment creation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId,
    });
    return {
      success: false,
      message: formatError(error),
    };
  } finally {
    session.endSession();
  }
}

/**
 * Gets the current status of a shipment from the warehouse provider.
 */
export async function getShipmentStatus(provider: string, trackingId: string) {
  try {
    const authSession = await auth();
    if (!authSession?.user?.id || !['Admin'].includes(authSession.user.role)) {
      throw new Error('Unauthorized');
    }

    const currentDate = new Date();
    logger.info('Getting shipment status', { provider, trackingId, userId: authSession.user.id });

    const warehouseProvider = warehouseProviders[provider];
    if (!warehouseProvider) throw new Error(`Invalid warehouse provider: ${provider}`);

    const status = await warehouseProvider.getShipmentStatus(trackingId);

    return {
      success: true,
      data: status,
    };
  } catch (error) {
    logger.error('Get shipment status error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      provider,
      trackingId,
    });
    return {
      success: false,
      message: formatError(error),
    };
  }
}