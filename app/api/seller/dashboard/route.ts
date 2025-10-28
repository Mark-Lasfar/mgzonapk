import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSellerMetrics, getSellerByUserId } from '@/lib/actions/seller.actions';
import { connectToDatabase } from '@/lib/db';
import Seller, { ISeller } from '@/lib/db/models/seller.model';
import { getTranslations } from 'next-intl/server';
import { logger } from '@/lib/api/services/logging';

interface DashboardResponse {
  success: boolean;
  message?: string;
  data?: {
    totalSales: number;
    totalOrders: number;
    totalProducts: number;
    averageRating: number;
    lastUpdate: string;
    monthlyStats: {
      revenue: number;
      orders: number;
      averageValue: number;
    };
    salesData: Array<{ name: string; sales: number }>;
  };
}

export async function GET(request: Request): Promise<NextResponse<DashboardResponse>> {
  const t = await getTranslations('api');
  const session = await auth();

  if (!session || session.user.role !== 'SELLER' || !session.user.id) {
    return NextResponse.json(
      { success: false, message: t('errors.unauthorized') },
      { status: 401 }
    );
  }

  try {
    await connectToDatabase();
    const sellerResult = await getSellerByUserId(session.user.id);
    if (!sellerResult.success || !sellerResult.data) {
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    const seller: ISeller = sellerResult.data;
    const now = new Date();

    if (
      seller.subscription.status !== 'active' ||
      (seller.subscription.endDate && new Date(seller.subscription.endDate) < now)
    ) {
      await Seller.findByIdAndUpdate(seller._id, {
        $set: {
          'subscription.status': 'expired',
          isActive: false,
          updatedAt: now,
        },
      });
      logger.warn('Subscription expired', { sellerId: seller._id, userId: session.user.id });
      return NextResponse.json(
        { success: false, message: t('errors.subscriptionExpired') },
        { status: 403 }
      );
    }

    const metrics = await getSellerMetrics(session.user.id);

    // Generate sales data for the past 7 days
    const salesData: Array<{ name: string; sales: number }> = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (6 - i));
      const daySales = seller.metrics.totalSalesHistory?.find(
        (sale) => new Date(sale.date).toDateString() === date.toDateString()
      )?.amount || 0;
      return {
        name: date.toLocaleDateString('en-US', { weekday: 'short' }),
        sales: daySales,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        totalSales: metrics.revenue.yearly,
        totalOrders: metrics.orders.total,
        totalProducts: metrics.products.total,
        averageRating: metrics.performance.rating,
        lastUpdate: now.toISOString(),
        monthlyStats: {
          revenue: metrics.revenue.monthly,
          orders: metrics.orders.total,
          averageValue: metrics.orders.avgOrderValue,
        },
        salesData,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Fetch dashboard error', { userId: session?.user.id, error: errorMessage });
    return NextResponse.json(
      { success: false, message: t('errors.internalServerError') },
      { status: 500 }
    );
  }
}