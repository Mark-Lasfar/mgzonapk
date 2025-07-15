import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import AdCampaign from '@/lib/db/models/ad-campaign.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const campaignFilterSchema = z.object({
  sellerId: z.string().optional(),
  providerName: z.string().optional(),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'failed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filters = campaignFilterSchema.parse({
      sellerId: searchParams.get('sellerId'),
      providerName: searchParams.get('providerName'),
      status: searchParams.get('status'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    });

    await connectToDatabase();

    const query: any = {};
    if (filters.sellerId) query.sellerId = filters.sellerId;
    if (filters.providerName) query.providerName = filters.providerName;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query['schedule.startDate'] = {};
      if (filters.startDate) query['schedule.startDate'].$gte = new Date(filters.startDate);
      if (filters.endDate) query['schedule.startDate'].$lte = new Date(filters.endDate);
    }

    const campaigns = await AdCampaign.find(query).populate('integrationId');
    logger.info('Ad campaigns retrieved', { requestId, count: campaigns.length });
    return NextResponse.json({ success: true, data: campaigns });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to retrieve ad campaigns', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    await connectToDatabase();

    const campaign = await AdCampaign.findById(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    await campaign.delete();
    logger.info('Ad campaign deleted', { requestId, campaignId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to delete ad campaign', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}