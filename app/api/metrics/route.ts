import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { auth } from '@/auth';
import { getTranslations, getLocale } from 'next-intl/server';
import { z } from 'zod';

const metricsFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metricType: z.enum(['sales', 'views', 'ratings', 'all']).default('all'),
});

export async function GET(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.metrics' });

    const session = await auth();
    if (!session?.user?.id) {
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
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    const { startDate, endDate, metricType } = parsedParams.data;
    let metrics = seller.metrics;

    if (startDate || endDate) {
      metrics = {
        ...metrics,
        totalSales: metrics.totalSales.filter((sale: any) =>
          (!startDate || new Date(sale.date) >= new Date(startDate)) &&
          (!endDate || new Date(sale.date) <= new Date(endDate))
        ).reduce((sum: number, sale: any) => sum + sale.amount, 0),
        views: metrics.views.filter((view: any) =>
          (!startDate || new Date(view.date) >= new Date(startDate)) &&
          (!endDate || new Date(view.date) <= new Date(endDate))
        ).length,
      };
    }

    if (metricType !== 'all') {
      metrics = { [metricType]: metrics[metricType] };
    }

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Metrics GET error:', error);
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
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
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    const body = await request.json();
    const metricUpdateSchema = z.object({
      metricType: z.enum(['sales', 'views', 'ratings']),
      value: z.any(),
    });

    const parsedData = metricUpdateSchema.safeParse(body);
    if (!parsedData.success) {
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
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    const { metricType, value } = parsedData.data;
    if (metricType === 'sales') {
      seller.metrics.totalSales.push({ amount: value, date: new Date() });
      seller.metrics.totalRevenue += value;
    } else if (metricType === 'views') {
      seller.metrics.views.push({ date: new Date() });
    } else if (metricType === 'ratings') {
      seller.metrics.rating = (seller.metrics.rating * seller.metrics.ratingsCount + value) /
        (seller.metrics.ratingsCount + 1);
      seller.metrics.ratingsCount += 1;
    }

    await seller.save();

    return NextResponse.json({
      success: true,
      message: t('metricUpdated'),
    });
  } catch (error) {
    console.error('Metrics POST error:', error);
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
      },
      { status: 500 }
    );
  }
}