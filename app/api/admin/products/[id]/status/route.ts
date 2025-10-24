import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import Seller from '@/lib/db/models/seller.model';
import { z } from 'zod';
// import { sendNotification } from '@/lib/actions/notification.actions';
import { ShipBobService } from '@/lib/api/integrations/shipbob/service';
import { sendNotification } from '@/lib/utils/notification';
// import { ShipBobService } from '@/lib/api/integrations/warehouses/shipbob/service';

// Validation schema
const statusSchema = z.object({
  status: z.enum(['active', 'pending', 'rejected']),
  reason: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check admin authentication
    const session = await auth();
    if (!session?.user?.role || session.user.role !== 'Admin') {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { status, reason } = statusSchema.parse(body);

await connectToDatabase();

    // Find the product
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    // Find the seller
    const seller = await Seller.findOne({ userId: product.sellerId });
    if (!seller) {
      return NextResponse.json(
        { success: false, message: 'Seller not found' },
        { status: 404 }
      );
    }

    // Update product status
    product.status = status;
    if (reason) {
      product.statusReason = reason;
    }
    await product.save();

    // Update product status in ShipBob if applicable
    if (seller.preferredWarehouse?.provider === 'ShipBob' && product.warehouseData?.[0]?.provider === 'shipbob') {
      const shipbobService = new ShipBobService({
        apiKey: process.env.SHIPBOB_API_KEY!,
        apiUrl: process.env.SHIPBOB_API_URL!,
      });

      try {
        await shipbobService.updateProductStatus({
          id: product.warehouseData[0].warehouseId,
          status: status === 'active' ? 'enabled' : 'disabled',
        });
      } catch (error) {
        console.error('ShipBob update error:', error);
        // Don't fail the request, but log the error
      }
    }

    // Send notification to seller
    await sendNotification({
      userId: product.sellerId,
      type: 'product_status_updated',
      title: `Product Status Updated: ${product.name}`,
      message: `Your product "${product.name}" has been set to "${status}"${
        reason ? `: ${reason}` : ''
      }`,
      channels: ['in_app', 'email'],
      data: { productId: product._id, status, reason },
    });

    return NextResponse.json({
      success: true,
      message: 'Product status updated successfully',
      data: { status, reason },
    });
  } catch (error) {
    console.error('Update product status error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid input',
          errors: error.errors,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      },
      { status: 500 }
    );
  }
}