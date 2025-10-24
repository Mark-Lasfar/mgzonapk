// /app/api/points/award/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { awardPoints } from '@/lib/actions/points.actions';
import { getTranslations } from 'next-intl/server';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Schema للتحقق من بيانات الـ POST
const awardPointsSchema = z.object({
  points: z.number().min(1, 'Points must be at least 1'),
  description: z.string().min(1, 'Description is required'),
  orderId: z.string().optional(),
});

async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, meta }),
    });
  } catch (err) {
    console.error('Failed to send log:', err);
  }
}

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('points.award');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      await sendLog('error', t('Unauthorized'), { requestId });
      return NextResponse.json({ success: false, error: t('Unauthorized') }, { status: 401 });
    }

    const body = await req.json();
    const { points, description, orderId } = awardPointsSchema.parse(body);

    const result = await awardPoints(session.user.id, points, description, orderId);
    if (!result.success) {
      await sendLog('error', 'Failed to award points', {
        requestId,
        userId: session.user.id,
        points,
        error: result.message,
      });
      return NextResponse.json({ success: false, error: result.message }, { status: 400 });
    }

    await sendLog('info', 'Points awarded successfully', {
      requestId,
      userId: session.user.id,
      points,
      description,
      orderId,
    });

    return NextResponse.json({ success: true, message: t('Points awarded successfully') });
  } catch (error) {
    const errorMessage = error instanceof z.ZodError
      ? error.errors.map((e) => e.message).join(', ')
      : error instanceof Error
      ? error.message
      : t('Server error');
    await sendLog('error', 'Failed to award points', {
      requestId,
      userId: session?.user?.id,
      error: errorMessage,
    });
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}