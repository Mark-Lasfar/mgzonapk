import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { logger } from '@/lib/api/services/logging';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const integrations = await Integration.find({ isActive: true });
    const analytics = await Promise.all(
      integrations.map(async (integration) => {
        const connectedSellers = await SellerIntegration.countDocuments({
          integrationId: integration._id,
          status: 'connected',
        });
        const totalConnections = await SellerIntegration.countDocuments({
          integrationId: integration._id,
        });
        const successRate = totalConnections ? connectedSellers / totalConnections : 0;
        const failureCount = await SellerIntegration.countDocuments({
          integrationId: integration._id,
          status: { $in: ['expired', 'needs_reauth'] },
        });
        const lastSync = await SellerIntegration.findOne({ integrationId: integration._id })
          .sort('-lastConnectedAt')
          .select('lastConnectedAt');

        return {
          providerName: integration.providerName,
          type: integration.type,
          connectedSellers,
          successRate,
          failureCount,
          lastSync: lastSync?.lastConnectedAt?.toISOString() || null,
        };
      })
    );

    logger.info('Fetched integration analytics', { userId: session.user.id });
    return NextResponse.json({ success: true, analytics });
  } catch (error) {
    logger.error('Failed to fetch analytics', { error: String(error) });
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}