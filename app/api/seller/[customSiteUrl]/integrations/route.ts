// /app/api/seller/[customSiteUrl]/integrations/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db'; 
import Seller from '@/lib/db/models/seller.model';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';

export async function GET(request: Request, { params }: { params: { customSiteUrl: string } }) {
  try {
    await connectToDatabase();
    const { customSiteUrl } = params;
    const { searchParams } = new URL(request.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    // العثور على البائع بناءً على customSiteUrl
    const seller = await Seller.findOne({ customSiteUrl });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    // جلب التكاملات اللي البائع enabled لها (من enabledBySellers في Integration)
    const integrations = await Integration.find({
      enabledBySellers: seller._id,
      sandbox,
      isActive: true,
    }).lean();

    // لكل تكامل، جلب الحالة الخاصة بالبائع من SellerIntegration
    const sellerIntegrations = await Promise.all(
      integrations.map(async (int) => {
        const sellerInt = await SellerIntegration.findOne({
          sellerId: seller._id.toString(),
          integrationId: int._id.toString(),
          sandbox,
        }).lean();

        return {
          ...int,
          _id: int._id.toString(),
          connected: sellerInt ? sellerInt.connectedBy : false,
          status: sellerInt ? sellerInt.status : 'disconnected',
          credentials: sellerInt ? sellerInt.credentials : {},
          webhook: sellerInt ? sellerInt.webhook : undefined,
          apiEndpoints: sellerInt ? sellerInt.apiEndpoints : undefined,
          lastUpdated: sellerInt ? sellerInt.lastUpdated : undefined,
        };
      })
    );

    return NextResponse.json({ data: sellerIntegrations });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { customSiteUrl: string } }) {
  try {
    await connectToDatabase();
    const { customSiteUrl } = params;
    const body = await request.json();
    const { integrationId, sandbox = false, credentials, webhook, apiEndpoints } = body;

    if (!integrationId) {
      return NextResponse.json({ error: 'integrationId is required' }, { status: 400 });
    }

    // العثور على البائع
    const seller = await Seller.findOne({ customSiteUrl });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    // التحقق إن التكامل enabled للبائع
    const integration = await Integration.findOne({
      _id: integrationId,
      enabledBySellers: seller._id,
    });
    if (!integration) {
      return NextResponse.json({ error: 'Integration not enabled for this seller' }, { status: 403 });
    }

    // إنشاء أو تحديث SellerIntegration (connect)
    const sellerIntegration = await SellerIntegration.findOneAndUpdate(
      { sellerId: seller._id.toString(), integrationId, sandbox },
      {
        connected: true,
        status: 'connected',
        credentials,
        webhook,
        apiEndpoints,
        lastUpdated: new Date(),
      },
      { upsert: true, new: true }
    );

    // هنا يمكن إضافة منطق OAuth أو connect إذا لزم (مثل redirect إلى authorizationUrl)

    return NextResponse.json({ data: sellerIntegration, message: 'Integration connected successfully' });
  } catch (error) {
    console.error('Error connecting integration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { customSiteUrl: string } }) {
  try {
    await connectToDatabase();
    const { customSiteUrl } = params;
    const body = await request.json();
    const { integrationId, sandbox = false, ...updateData } = body;

    if (!integrationId) {
      return NextResponse.json({ error: 'integrationId is required' }, { status: 400 });
    }

    // العثور على البائع
    const seller = await Seller.findOne({ customSiteUrl });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    // تحديث SellerIntegration
    const sellerIntegration = await SellerIntegration.findOneAndUpdate(
      { sellerId: seller._id.toString(), integrationId, sandbox },
      { ...updateData, lastUpdated: new Date() },
      { new: true }
    );

    if (!sellerIntegration) {
      return NextResponse.json({ error: 'SellerIntegration not found' }, { status: 404 });
    }

    return NextResponse.json({ data: sellerIntegration, message: 'Integration updated successfully' });
  } catch (error) {
    console.error('Error updating integration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { customSiteUrl: string } }) {
  try {
    await connectToDatabase();
    const { customSiteUrl } = params;
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('integrationId');
    const sandbox = searchParams.get('sandbox') === 'true';

    if (!integrationId) {
      return NextResponse.json({ error: 'integrationId is required' }, { status: 400 });
    }

    // العثور على البائع
    const seller = await Seller.findOne({ customSiteUrl });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    // تحديث الحالة إلى disconnected (بدل الحذف، عشان نحافظ على التاريخ)
    const sellerIntegration = await SellerIntegration.findOneAndUpdate(
      { sellerId: seller._id.toString(), integrationId, sandbox },
      { connected: false, status: 'disconnected', lastUpdated: new Date() },
      { new: true }
    );

    if (!sellerIntegration) {
      return NextResponse.json({ error: 'SellerIntegration not found' }, { status: 404 });
    }

    // إذا عايز تحذف تمامًا: await SellerIntegration.deleteOne({ ... });

    return NextResponse.json({ message: 'Integration disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting integration:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}