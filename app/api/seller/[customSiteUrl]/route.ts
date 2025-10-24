// app/api/seller/[customSiteUrl]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { customLogger } from '@/lib/api/services/logging';
import { auth } from '@/auth';
import mongoose from 'mongoose';
import crypto from 'crypto';

export async function GET(request: NextRequest, { params }: { params: { customSiteUrl: string } }) {
  const requestId = crypto.randomUUID();

  try {
    await connectToDatabase();
    const session = await auth();

    const { customSiteUrl } = params;  // ✅ customSiteUrl بدل userId

    // ✅ تحقق من صحة ObjectId أو customSiteUrl
    if (mongoose.isValidObjectId(customSiteUrl)) {
      // لو ObjectId → استخدمه كـ userId
      if (!session?.user?.id || session.user.id !== customSiteUrl) {
        await customLogger.error('Unauthorized access to seller data', { requestId, customSiteUrl, service: 'api' });
        return NextResponse.json(
          { success: false, error: 'Unauthorized', requestId, timestamp: new Date().toISOString() },
          { status: 401 }
        );
      }
    }

    // ابحث بالـ userId أو customSiteUrl
    const sellerQuery = mongoose.isValidObjectId(customSiteUrl) 
      ? { userId: customSiteUrl } 
      : { customSiteUrl };

    const seller = await Seller.findOne(sellerQuery).lean();
    if (!seller) {
      await customLogger.error('Seller not found', { requestId, customSiteUrl, service: 'api' });
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