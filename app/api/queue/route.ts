import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Queue from '@/lib/db/models/queue.model';
import { getTranslations, getLocale } from 'next-intl/server';
import { customLogger } from '@/lib/api/services/logging';
import { auth } from '@/auth';
import mongoose from 'mongoose';
import { z } from 'zod';
import crypto from 'crypto';

const queueSchema = z.object({
  taskType: z.enum(['order processing', 'inventory update', 'recommendation training']),
  payload: z.record(z.any()),
  priority: z.number().min(1).max(10).default(5),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized queue POST request', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.queue' });

    const body = await request.json();
    const parsedData = queueSchema.safeParse(body);

    if (!parsedData.success) {
      await customLogger.error('Invalid queue data', { requestId, errors: parsedData.error.errors, service: 'api' });
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: parsedData.error.errors,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const queueItem = await Queue.create({
      ...parsedData.data,
      createdAt: new Date(),
      userId: session.user.id,
    });

    await customLogger.info('Queue task created', { requestId, taskId: queueItem._id, taskType: queueItem.taskType, service: 'api' });
    return NextResponse.json({
      success: true,
      message: t('taskAdded'),
      data: {
        id: queueItem._id,
        taskType: queueItem.taskType,
        status: queueItem.status,
      },
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Queue POST error', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized queue GET request', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.queue' });

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const status = searchParams.get('status');

    await connectToDatabase();
    let query: any = { userId: session.user.id };

    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      query._id = taskId;
    }
    if (status) {
      query.status = status;
    }

    const queueItems = await Queue.find(query).sort({ createdAt: -1 }).limit(50);

    await customLogger.info('Queue items fetched', { requestId, count: queueItems.length, service: 'api' });
    return NextResponse.json({
      success: true,
      data: queueItems.map((item) => ({
        id: item._id,
        taskType: item.taskType,
        status: item.status,
        priority: item.priority,
        createdAt: item.createdAt,
      })),
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Queue GET error', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await customLogger.error('Unauthorized queue DELETE request', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.queue' });

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      await customLogger.error('Invalid taskId', { requestId, taskId, service: 'api' });
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidTaskId'),
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const queueItem = await Queue.findOne({ _id: taskId, userId: session.user.id });

    if (!queueItem) {
      await customLogger.error('Queue task not found', { requestId, taskId, service: 'api' });
      return NextResponse.json(
        {
          success: false,
          message: t('errors.taskNotFound'),
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    if (queueItem.status === 'processing') {
      await customLogger.error('Cannot delete processing task', { requestId, taskId, service: 'api' });
      return NextResponse.json(
        {
          success: false,
          message: t('errors.taskInProgress'),
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    await Queue.deleteOne({ _id: taskId });

    await customLogger.info('Queue task deleted', { requestId, taskId, service: 'api' });
    return NextResponse.json({
      success: true,
      message: t('taskDeleted'),
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Queue DELETE error', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}