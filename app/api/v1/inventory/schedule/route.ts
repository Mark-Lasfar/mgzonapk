import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { ScheduleManager } from '@/lib/api/services/schedule-manager';
import { UnifiedFulfillmentService } from '@/lib/api/services/unified-fulfillment';
import { SyncProgressTracker } from '@/lib/api/services/sync-progress';
import { NotificationService } from '@/lib/api/services/notification';
import { logger } from '@/lib/api/services/logging';
import { ObservabilityService } from '@/lib/api/services/observability';
import { connectToDatabase } from '@/lib/db';
import ScheduleModel from '@/lib/db/models/schedule.model';
import { z } from 'zod';

const scheduleManager = new ScheduleManager(
  new UnifiedFulfillmentService(),
  new SyncProgressTracker(),
  new NotificationService()
);

// Validation schema
const scheduleSchema = z.object({
  name: z.string(),
  provider: z.string(),
  enabled: z.boolean(),
  frequency: z.object({
    type: z.enum(['interval', 'cron']),
    value: z.string(),
    hours: z.array(z.number()).optional(),
    daysOfWeek: z.array(z.number()).optional(),
    daysOfMonth: z.array(z.number()).optional(),
  }),
  timezone: z.string(),
  settings: z.object({
    retryOnFailure: z.boolean(),
    maxRetries: z.number(),
    notifyOnCompletion: z.boolean(),
    notifyOnFailure: z.boolean(),
    skipWeekends: z.boolean().optional(),
    skipHolidays: z.boolean().optional(),
  }),
  filters: z
    .object({
      warehouses: z.array(z.string()).optional(),
      productTypes: z.array(z.string()).optional(),
      categories: z.array(z.string()).optional(),
    })
    .optional(),
  notifications: z.object({
    email: z.array(z.string()).optional(),
    slack: z.string().optional(),
    webhook: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const authError = await validateApiKey(request);
    if (authError) return authError;

    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    const data = await request.json();

    // Validate request body
    const parsed = scheduleSchema.safeParse(data);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid schedule configuration',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const schedule = await scheduleManager.createSchedule({
      ...parsed.data,
      createdBy: request.headers.get('x-user-id') || 'system',
    });

    await ObservabilityService.getInstance().recordMetric({
      name: 'api.schedule.created',
      value: 1,
      timestamp: new Date(),
      tags: { provider: schedule.provider },
    });

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ObservabilityService.getInstance().recordError({
      error: errorMessage,
      context: { endpoint: 'POST /inventory/schedule' },
      timestamp: new Date(),
    });
    logger.error('Create schedule failed', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authError = await validateApiKey(request);
    if (authError) return authError;

    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');

    if (scheduleId) {
      const schedule = await ScheduleModel.findById(scheduleId);
      if (!schedule) {
        return NextResponse.json(
          { success: false, error: 'Schedule not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: schedule });
    }

    const schedules = await ScheduleModel.find({}).sort({ createdAt: -1 }).limit(100);

    await ObservabilityService.getInstance().recordMetric({
      name: 'api.schedule.list',
      value: 1,
      timestamp: new Date(),
    });

    return NextResponse.json({
      success: true,
      data: schedules,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await ObservabilityService.getInstance().recordError({
      error: errorMessage,
      context: { endpoint: 'GET /inventory/schedule' },
      timestamp: new Date(),
    });
    logger.error('Get schedules failed', {
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}