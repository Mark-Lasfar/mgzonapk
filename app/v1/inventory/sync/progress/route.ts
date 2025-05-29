import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { SyncProgressTracker } from '@/lib/api/services/sync-progress';
import { logger } from '@/lib/api/services/logging';

const progressTracker = new SyncProgressTracker();

export async function GET(request: NextRequest) {
  try {
    // Validate API key
    const authError = await validateApiKey(request);
    if (authError) return authError;

    // Check rate limits
    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');

    if (syncId) {
      // Get specific sync progress
      const progress = await progressTracker.getProgress(syncId);
      
      if (!progress) {
        return NextResponse.json(
          { success: false, error: 'Sync not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: progress,
      });
    } else {
      // List active syncs
      const activeSyncs = await progressTracker.listActiveSyncs();
      
      return NextResponse.json({
        success: true,
        data: {
          syncs: activeSyncs,
          count: activeSyncs.length,
        },
      });
    }

  } catch (error) {
    logger.error('Error fetching sync progress', { error });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Validate API key
    const authError = await validateApiKey(request);
    if (authError) return authError;

    // Check rate limits
    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');

    if (!syncId) {
      return NextResponse.json(
        { success: false, error: 'Sync ID is required' },
        { status: 400 }
      );
    }

    const progress = await progressTracker.cancelSync(syncId);

    return NextResponse.json({
      success: true,
      data: progress,
    });

  } catch (error) {
    logger.error('Error cancelling sync', { error });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}