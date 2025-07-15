import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { auth } from '@/auth';
import { getTranslations, getLocale } from 'next-intl/server';
import { z } from 'zod';
import { PrometheusMetrics } from '@/lib/api/services/metrics';

const metrics = new PrometheusMetrics();

const metricsFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metricType: z.enum(['sales', 'views', 'ratings', 'all']).default('all'),
});

const metricUpdateSchema = z.object({
  metricType: z.enum(['sales', 'views', 'ratings']),
  value: z.union([
    z.number().positive('Value must be positive for sales or ratings'),
    z.literal(1).transform(() => ({ date: new Date() })), // للـ views
  ]),
});

export async function GET(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.metrics' });

    const session = await auth();
    if (!session?.user?.id) {
      await metrics.recordError({ error: 'Unauthorized access', context: { route: 'metrics.GET' }, timestamp: new Date() });
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsedParams = metricsFilterSchema.safeParse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      metricType: searchParams.get('metricType'),
    });

    if (!parsedParams.success) {
      await metrics.recordError({ error: 'Invalid parameters', context: { errors: parsedParams.error.errors }, timestamp: new Date() });
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidParams'),
          errors: parsedParams.error.errors,
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id });

    if (!seller) {
      await metrics.recordError({ error: 'Seller not found', context: { userId: session.user.id }, timestamp: new Date() });
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    const { startDate, endDate, metricType } = parsedParams.data;
    let metricsData: { totalSales?: any[]; totalRevenue?: number; views?: any[]; rating?: number; ratingsCount?: number } = seller.metrics;

    if (startDate || endDate) {
      metricsData = {
        ...metricsData,
        totalSales: metricsData.totalSales?.filter((sale: any) =>
          (!startDate || new Date(sale.date) >= new Date(startDate)) &&
          (!endDate || new Date(sale.date) <= new Date(endDate))
        )?.reduce((sum: number, sale: any) => sum + sale.amount, 0) || 0,
        views: metricsData.views?.filter((view: any) =>
          (!startDate || new Date(view.date) >= new Date(startDate)) &&
          (!endDate || new Date(view.date) <= new Date(endDate))
        )?.length || 0,
      };
    }

    if (metricType !== 'all') {
      metricsData = { [metricType]: metricsData[metricType] };
    }

    await metrics.recordMetric({
      name: 'metrics.retrieved',
      value: 1,
      timestamp: new Date(),
      tags: { metricType },
    });

    return NextResponse.json({
      success: true,
      data: metricsData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await metrics.recordError({ error: errorMessage, context: { route: 'metrics.GET' }, timestamp: new Date() });
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.metrics' });

    const session = await auth();
    if (!session?.user?.id) {
      await metrics.recordError({ error: 'Unauthorized access', context: { route: 'metrics.POST' }, timestamp: new Date() });
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsedData = metricUpdateSchema.safeParse(body);
    if (!parsedData.success) {
      await metrics.recordError({ error: 'Invalid data', context: { errors: parsedData.error.errors }, timestamp: new Date() });
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: parsedData.error.errors,
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id });

    if (!seller) {
      await metrics.recordError({ error: 'Seller not found', context: { userId: session.user.id }, timestamp: new Date() });
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    const { metricType, value } = parsedData.data;
    if (metricType === 'sales') {
      seller.metrics.totalSales.push({ amount: value, date: new Date() });
      seller.metrics.totalRevenue = (seller.metrics.totalRevenue || 0) + value;
    } else if (metricType === 'views') {
      seller.metrics.views.push(value);
    } else if (metricType === 'ratings') {
      seller.metrics.rating = (seller.metrics.rating * seller.metrics.ratingsCount + value) /
        (seller.metrics.ratingsCount + 1);
      seller.metrics.ratingsCount += 1;
    }

    await seller.save();

    await metrics.recordMetric({
      name: 'metrics.updated',
      value: 1,
      timestamp: new Date(),
      tags: { metricType },
    });

    return NextResponse.json({
      success: true,
      message: t('metricUpdated'),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await metrics.recordError({ error: errorMessage, context: { route: 'metrics.POST' }, timestamp: new Date() });
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}