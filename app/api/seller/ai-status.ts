import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import Setting from '@/lib/db/models/setting.model';
import { getSession } from 'next-auth/react';
import { customLogger } from '@/lib/api/services/logging';

export async function GET(req: Request) {
  try {
    const session = await getSession({ req });
    if (!session || !session.user?.id) {
      customLogger.error('Unauthorized access attempt', { service: 'ai-status' });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const sellerId = url.searchParams.get('sellerId');
    if (!sellerId || sellerId !== session.user.id) {
      customLogger.error('Invalid or unauthorized sellerId', { service: 'ai-status', sellerId });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const seller = await Seller.findById(sellerId).select('aiAssistant');
    if (!seller) {
      customLogger.error('Seller not found', { service: 'ai-status', sellerId });
      return NextResponse.json({ message: 'Seller not found' }, { status: 404 });
    }

    const settings = await Setting.findOne().select('aiAssistant');
    if (!settings) {
      customLogger.error('Settings not found', { service: 'ai-status', sellerId });
      return NextResponse.json({ message: 'Settings not found' }, { status: 404 });
    }

    const now = new Date();
    const isSubscribed = seller.aiAssistant.status === 'premium' && seller.aiAssistant.subscriptionEnd > now;

    return NextResponse.json({
      uses: seller.aiAssistant.uses,
      limit: settings.aiAssistant.freeLimit,
      status: seller.aiAssistant.status,
      isSubscribed,
      enabled: settings.aiAssistant.enabled,
      subscriptionEnd: seller.aiAssistant.subscriptionEnd?.toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    customLogger.error('Failed to fetch AI status', { service: 'ai-status', error: errorMessage });
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
}