import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { getSession } from 'next-auth/react';
// import { customLogger } from '@/lib/db';
import { customLogger } from '@/lib/api/services/logging';

export async function POST(req: Request) {
  try {
    const session = await getSession({ req });
    if (!session || !session.user?.id) {
      customLogger.error('Unauthorized access attempt', { service: 'ai-uses' });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { sellerId } = await req.json();
    if (!sellerId || sellerId !== session.user.id) {
      customLogger.error('Invalid or unauthorized sellerId', { service: 'ai-uses', sellerId });
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const seller = await Seller.findByIdAndUpdate(
      sellerId,
      { $inc: { 'aiAssistant.uses': 1 } },
      { new: true }
    );

    if (!seller) {
      customLogger.error('Seller not found', { service: 'ai-uses', sellerId });
      return NextResponse.json({ message: 'Seller not found' }, { status: 404 });
    }

    customLogger.info('AI uses incremented', { service: 'ai-uses', sellerId });

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    customLogger.error('Failed to increment AI uses', { service: 'ai-uses', error: errorMessage });
    return NextResponse.json({ message: 'Internal Server Error', error: errorMessage }, { status: 500 });
  }
}