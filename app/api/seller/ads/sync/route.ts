import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import AdCampaign from '@/lib/db/models/ad-campaign.model';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId');
    const sandbox = searchParams.get('sandbox') === 'true';

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const campaign = await AdCampaign.findOne({ _id: campaignId, sellerId: session.user.id });
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const integration = await Integration.findById(campaign.integrationId);
    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: session.user.id,
      integrationId: campaign.integrationId,
      isActive: true,
      sandbox,
    });

    if (!integration || !sellerIntegration) {
      return NextResponse.json({ error: 'Integration not found or not connected' }, { status: 400 });
    }

    const service = new GenericIntegrationService(integration, sellerIntegration);
    const metricsResponse = await service.callApi({
      endpoint: integration.settings.endpoints?.['syncMetrics'] || `/campaigns/${campaign.campaignId}/metrics`,
      method: 'GET',
    }) as {
      impressions?: number;
      clicks?: number;
      conversions?: number;
      spend?: number;
    };

    campaign.metrics = {
      impressions: metricsResponse.impressions || 0,
      clicks: metricsResponse.clicks || 0,
      conversions: metricsResponse.conversions || 0,
      spend: metricsResponse.spend || 0,
    };
    await campaign.save();

    logger.info('Campaign metrics synced', { requestId, sellerId: session.user.id, campaignId });
    return NextResponse.json({ success: true, data: campaign });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to sync campaign metrics', { requestId, error: errorMessage });
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}