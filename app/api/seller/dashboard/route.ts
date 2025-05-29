import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSellerMetrics, getSellerByUserId } from '@/lib/actions/seller.actions';

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== 'SELLER') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sellerResult = await getSellerByUserId(session.user.id);
    if (!sellerResult.success || !sellerResult.data) {
      return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
    }

    const metrics = await getSellerMetrics(session.user.id);
    const salesData = [
      { name: 'Mon', sales: 100 },
      { name: 'Tue', sales: 150 },
      { name: 'Wed', sales: 200 },
      { name: 'Thu', sales: 180 },
      { name: 'Fri', sales: 220 },
      { name: 'Sat', sales: 300 },
      { name: 'Sun', sales: 250 },
    ];

    return NextResponse.json({
      success: true,
      data: {
        totalSales: metrics.revenue.yearly,
        totalOrders: metrics.orders.total,
        totalProducts: metrics.products.total,
        averageRating: metrics.performance.rating,
        lastUpdate: new Date().toISOString(),
        monthlyStats: {
          revenue: metrics.revenue.monthly,
          orders: metrics.orders.total,
          averageValue: metrics.orders.avgOrderValue,
        },
        salesData,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}