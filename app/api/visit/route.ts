import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Visit from '@/lib/db/models/visit.model';
import { getTranslations } from 'next-intl/server';
import crypto from 'crypto';

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
  const requestId = crypto.randomUUID();
  const t = await getTranslations('visit');

  try {
    const { visitorId, sellerId, page, productId, customSiteUrl } = await req.json();
    if (!visitorId || !sellerId) {
      await sendLog('error', t('Invalid visit data'), { requestId, visitorId, sellerId });
      return NextResponse.json({ success: false, message: t('Invalid visit data') }, { status: 400 });
    }

    await connectToDatabase();
    await Visit.create({
      visitorId,
      sellerId,
      page,
      productId,
      customSiteUrl,
      timestamp: new Date(),
    });

    await sendLog('info', t('Visit recorded'), { requestId, visitorId, sellerId });
    return NextResponse.json({ success: true, message: t('Visit recorded') });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Server error');
    await sendLog('error', t('Failed to record visit'), { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}