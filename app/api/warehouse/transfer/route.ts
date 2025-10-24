import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Seller from '@/lib/db/models/seller.model';
import WarehouseTransfer from '@/lib/db/models/warehouse-transfer.model';
import Product from '@/lib/db/models/product.model';
import Integration from '@/lib/db/models/integration.model';
import { logger } from '@/lib/api/services/logging';
import { sendNotification } from '@/lib/utils/notification';
import { z } from 'zod';
// import { sendNotification } from '@/lib/actions/notification.actions';

import { UnifiedFulfillmentService } from '@/lib/api/services/unified-fulfillment';

const transferSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  sourceWarehouseId: z.string().min(1, 'Source warehouse ID is required'),
  targetWarehouseId: z.string().min(1, 'Target warehouse ID is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const validatedData = transferSchema.parse(body);
    await connectToDatabase();

    // Verify seller
    const seller = await Seller.findOne({ userId: session.user.id }).populate('integrations.providerId');
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    // Verify warehouse integrations
    const sourceIntegration = seller.integrations.find(
      (i: any) => i.providerId.warehouseId === validatedData.sourceWarehouseId && i.isActive
    );
    const targetIntegration = seller.integrations.find(
      (i: any) => i.providerId.warehouseId === validatedData.targetWarehouseId && i.isActive
    );

    if (!sourceIntegration || !targetIntegration) {
      return NextResponse.json({ error: 'Invalid or disconnected warehouses' }, { status: 400 });
    }

    // Verify product and quantity
    const product = await Product.findOne({
      _id: validatedData.productId,
      sellerId: seller._id,
      'warehouseData.warehouseId': validatedData.sourceWarehouseId,
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found in source warehouse' }, { status: 404 });
    }

    const sourceWarehouse = product.warehouseData.find(
      (w: any) => w.warehouseId === validatedData.sourceWarehouseId
    );
    if (!sourceWarehouse || sourceWarehouse.quantity < validatedData.quantity) {
      return NextResponse.json({ error: 'Insufficient stock in source warehouse' }, { status: 400 });
    }

    // Calculate transfer fee
    const sourceProvider = await Integration.findById(sourceIntegration.providerId);
    const targetProvider = await Integration.findById(targetIntegration.providerId);
    const transferFee = sourceProvider?.providerName !== targetProvider?.providerName ? validatedData.quantity * 0.5 : 0;

    // Create transfer record
    const transfer = await WarehouseTransfer.create({
      sellerId: seller._id,
      productId: validatedData.productId,
      sourceWarehouseId: validatedData.sourceWarehouseId,
      targetWarehouseId: validatedData.targetWarehouseId,
      quantity: validatedData.quantity,
      transferFee,
      status: validatedData.scheduledAt ? 'scheduled' : 'pending',
      scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined,
      createdBy: session.user.id,
    });

    // Process transfer if not scheduled
    if (!validatedData.scheduledAt) {
      const fulfillmentService = new UnifiedFulfillmentService({
        provider: sourceProvider?.providerName as any,
        apiKey: sourceIntegration.apiKey,
        credentials: {
          accessToken: sourceIntegration.accessToken,
          refreshToken: sourceIntegration.refreshToken,
        },
      });

      try {
        await fulfillmentService.transferStock({
          productId: validatedData.productId,
          sourceWarehouseId: validatedData.sourceWarehouseId,
          targetWarehouseId: validatedData.targetWarehouseId,
          quantity: validatedData.quantity,
          sourceProvider: sourceProvider?.providerName,
          targetProvider: targetProvider?.providerName,
          sourceAccessToken: sourceIntegration.accessToken,
          targetAccessToken: targetIntegration.accessToken,
        });

        // Update product quantities
        sourceWarehouse.quantity -= validatedData.quantity;
        const targetWarehouse = product.warehouseData.find(
          (w: any) => w.warehouseId === validatedData.targetWarehouseId
        );
        if (targetWarehouse) {
          targetWarehouse.quantity += validatedData.quantity;
        } else {
          product.warehouseData.push({
            warehouseId: validatedData.targetWarehouseId,
            provider: targetProvider?.providerName,
            sku: sourceWarehouse.sku,
            quantity: validatedData.quantity,
            location: targetIntegration.metadata?.location || 'Unknown',
            minimumStock: 5,
            reorderPoint: 10,
            colors: sourceWarehouse.colors,
          });
        }
        await product.save();

        transfer.status = 'completed';
        transfer.completedAt = new Date();
        await transfer.save();

        await sendNotification({
          userId: session.user.id,
          type: 'warehouse_transfer',
          title: `Transfer #${transfer._id} Completed`,
          message: `Successfully transferred ${validatedData.quantity} units of product ${product.name}.`,
          channels: ['email', 'in_app'],
          data: { transferId: transfer._id },
        });

        logger.info('Warehouse transfer completed', { requestId, transferId: transfer._id });
      } catch (error) {
        transfer.status = 'failed';
        transfer.errorMessage = String(error);
        await transfer.save();

        await sendNotification({
          userId: session.user.id,
          type: 'warehouse_transfer_failed',
          title: `Transfer #${transfer._id} Failed`,
          message: `Failed to transfer ${validatedData.quantity} units of product ${product.name}.`,
          channels: ['email', 'in_app'],
          data: { transferId: transfer._id },
        });

        logger.error('Warehouse transfer failed', { requestId, error: String(error) });
        return NextResponse.json({ error: 'Failed to process transfer' }, { status: 500 });
      }
    } else {
      logger.info('Warehouse transfer scheduled', { requestId, transferId: transfer._id });
    }

    return NextResponse.json({ success: true, data: transfer });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to process transfer', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
