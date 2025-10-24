// app/api/seller/ads/route.ts
import { NextResponse } from 'next/server';
import AdCampaign from '@/lib/db/models/ad-campaign.model';
import { getSellerByUserId } from '@/lib/actions/seller.actions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sellerId = searchParams.get('sellerId') || '';
  const sandbox = searchParams.get('sandbox') === 'true';
  const status = searchParams.get('status') || '';
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');

  try {
    const seller = await getSellerByUserId(sellerId);
    if (!seller.success || !seller.data) {
      return NextResponse.json({ message: 'Seller not found' }, { status: 404 });
    }

    let query: any = { sellerId, sandbox };
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    const campaigns = await AdCampaign.find(query)
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await AdCampaign.countDocuments(query);

    return NextResponse.json({
      data: campaigns,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return NextResponse.json({ message: 'Failed to fetch campaigns' }, { status: 500 });
  }
}