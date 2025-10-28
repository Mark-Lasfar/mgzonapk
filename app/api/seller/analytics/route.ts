import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { AnalyticsService } from '@/lib/api/services/analytics';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { getTranslations } from 'next-intl/server';
import Integration from '@/lib/db/models/integration.model';

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('analytics');
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: t('Unauthorized') }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const metric = searchParams.get('metric');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!metric || !startDate || !endDate) {
      return NextResponse.json({ error: t('Missing Parameters') }, { status: 400 });
    }

    // جلب أول تكامل تحليلات متاح للبائع
    const integration = await Integration.findOne({
      type: 'analytics',
      isActive: true,
    }).lean();

    if (!integration) {
      return NextResponse.json(
        { error: t('No Analytics Integration') },
        { status: 400 }
      );
    }

    const analyticsService = new AnalyticsService();
    const data = await analyticsService.getMetrics(
      integration._id.toString(), // providerId: استخدام معرف التكامل
      session.user.id, // sellerId
      { metric, startDate, endDate, filters: { userId: session.user.id } } // query
    );

    customLogger.info('Analytics data fetched', {
      requestId,
      userId: session.user.id,
      metric,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    customLogger.error('Failed to fetch analytics data', {
      requestId,
      error: errorMessage,
    });
    return NextResponse.json(
      { error: `${t('Error Title')}: ${errorMessage}` },
      { status: 500 }
    );
  }
}