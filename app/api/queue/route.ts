import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Queue from '@/lib/db/models/queue.model';
import { getTranslations, getLocale } from 'next-intl/server';
import mongoose from 'mongoose';
import { z } from 'zod';

const queueSchema = z.object({
  taskType: z.enum(['order_processing', 'inventory_update', 'recommendation_training']),
  payload: z.record(z.any()),
  priority: z.number().min(1).max(10).default(5),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
});

export async function POST(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.queue' });

    const body = await request.json();
    const parsedData = queueSchema.safeParse(body);

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
    const queueItem = await Queue.create({
      ...parsedData.data,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: t('taskAdded'),
      data: {
        id: queueItem._id,
        taskType: queueItem.taskType,
        status: queueItem.status,
      },
    });
  } catch (error) {
    console.error('Queue POST error:', error);
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.queue' });

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    const status = searchParams.get('status');

    await connectToDatabase();
    let query: any = {};

    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      query._id = taskId;
    }
    if (status) {
      query.status = status;
    }

    const queueItems = await Queue.find(query).sort({ createdAt: -1 }).limit(50);

    return NextResponse.json({
      success: true,
      data: queueItems.map(item => ({
        id: item._id,
        taskType: item.taskType,
        status: item.status,
        priority: item.priority,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error('Queue GET error:', error);
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api.queue' });

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidTaskId'),
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const queueItem = await Queue.findById(taskId);

    if (!queueItem) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.taskNotFound'),
        },
        { status: 404 }
      );
    }

    if (queueItem.status === 'processing') {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.taskInProgress'),
        },
        { status: 400 }
      );
    }

    await Queue.deleteOne({ _id: taskId });

    return NextResponse.json({
      success: true,
      message: t('taskDeleted'),
    });
  } catch (error) {
    console.error('Queue DELETE error:', error);
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
      },
      { status: 500 }
    );
  }
}