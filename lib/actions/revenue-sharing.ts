import Product from '@/lib/db/models/product.model';
import Partner from '@/lib/db/models/partner.model';

export async function handleRevenueSharing(productId: string, saleAmount: number) {
  const product = await Product.findById(productId);

  if (!product) {
    throw new Error('Product not found');
  }

  let platformCommission = 0;
  let sellerRevenue = 0;
  let sourceRevenue = 0;

  // Platform commission (e.g., 15% of the sale amount)
  platformCommission = (saleAmount * 15) / 100;
  sellerRevenue = saleAmount - platformCommission;

  if (product.sourceSellerId) {
    // Revenue sharing with the source seller
    const sourceSeller = await Partner.findById(product.sourceSellerId);
    if (sourceSeller) {
      sourceRevenue = (saleAmount * 10) / 100; // Example: 10% share
      sellerRevenue -= sourceRevenue;
      sourceSeller.balance += sourceRevenue;
      await sourceSeller.save();
    }
  }

  // Update the product's metrics
  product.metrics.sales += 1;
  product.metrics.revenue += saleAmount;
  product.metrics.lastSold = new Date();
  await product.save();

  return {
    platformCommission,
    sellerRevenue,
    sourceRevenue,
  };
}