// /lib/services/warehouse/utils.ts
import { connectToDatabase } from '@/lib/db';
import { IIntegration } from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
// import SellerIntegration from '@/lib/db/models/sellerIntegration.model';
import { WarehouseIntegration } from '@/lib/services/integration/categories/warehouse';
import mongoose from 'mongoose';

export async function getWarehouseProvider(sellerId: string, providerName: string): Promise<WarehouseIntegration> {
  await connectToDatabase();

  // استرجاع التكامل بناءً على اسم الموفر ونوع التكامل
  const integration = await mongoose.model('Integration').findOne({
    providerName,
    type: 'warehouse',
    isActive: true,
  });

  if (!integration) {
    throw new Error(`Warehouse provider ${providerName} not found or inactive`);
  }

  // التحقق من أن البائع قد قام بتفعيل التكامل
  const sellerIntegration = await SellerIntegration.findOne({
    sellerId,
    integrationId: integration._id,
    isActive: true,
  });

  if (!sellerIntegration) {
    throw new Error(`Integration ${providerName} not active for seller ${sellerId}`);
  }

  // إنشاء مثيل من WarehouseIntegration
  return new WarehouseIntegration(integration._id.toString());
}