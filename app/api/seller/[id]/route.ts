import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { customLogger } from '@/lib/api/services/logging';
import { auth } from '@/auth';
import mongoose from 'mongoose';
import crypto from 'crypto';

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  const requestId = crypto.randomUUID();

  try {
    await connectToDatabase();
    const session = await auth();

    const { userId } = params;

    if (!mongoose.isValidObjectId(userId)) {
      await customLogger.error('Invalid user ID format', { requestId, userId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Invalid user ID', requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // Check if the user is authorized
    if (!session?.user?.id || session.user.id !== userId) {
      await customLogger.error('Unauthorized access to seller data', { requestId, userId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const seller = await Seller.findOne({ userId }).lean();
    if (!seller) {
      await customLogger.error('Seller not found', { requestId, userId, service: 'api' });
      return NextResponse.json(
        { success: false, error: 'Seller not found', requestId, timestamp: new Date().toISOString() },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: seller,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Error fetching seller', { requestId, error: errorMessage, service: 'api' });
    return NextResponse.json(
      {
        success: false,
        error: 'Server error',
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}