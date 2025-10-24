// /app/api/seller/[customSiteUrl]/integrations/[integrationId]/disconnect/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';

export async function POST(request: Request, { params }: { params: { customSiteUrl: string; integrationId: string } }) {
  try {
    await connectToDatabase();
    const { customSiteUrl, integrationId } = params;
    const { searchParams } = new URL(request.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    const seller = await Seller.findOne({ customSiteUrl });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const sellerIntegration = await SellerIntegration.findOneAndUpdate(
      { sellerId: seller._id.toString(), integrationId, sandbox },
      { connected: false, status: 'disconnected', lastUpdated: new Date() },
      { new: true }
    );

    if (!sellerIntegration) {
      return NextResponse.json({ error: 'SellerIntegration not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Integration disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting integration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}