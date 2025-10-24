import { NextRequest, NextResponse } from 'next/server';
import Seller from '@/lib/db/models/seller.model';
import Partner from '@/lib/db/models/partner.model';
import Integration, { IIntegration } from '@/lib/db/models/integration.model';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { Types } from 'mongoose';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const { searchParams } = new URL(req.url);
    const partnerId = searchParams.get('partnerId');

    if (!session?.user?.id && !partnerId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    let responseData: any;
    let paymentIntegrations: IIntegration[] = [];

    if (partnerId) {
      // جلب بيانات الشريك
      const partner = await Partner.findById(partnerId);
      if (!partner) {
        return NextResponse.json({ success: false, message: 'Partner not found' }, { status: 404 });
      }
      responseData = {
        totalEarnings: partner.totalEarnings,
        balance: partner.balance,
        transactions: partner.transactions,
      };
    } else if (session?.user?.id) {
      // جلب بيانات البائع
      const seller = await Seller.findOne({ userId: session.user.id }).select(
        'metrics.totalRevenue pointsBalance pointsHistory _id'
      );
      if (!seller) {
        return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
      }

      // جلب التكاملات الديناميكية المفعلة للبائع (بوابات الدفع)
      paymentIntegrations = await Integration.find({
        type: 'payment',
        isActive: true,
        enabledBySellers: new Types.ObjectId(seller._id),
      }).lean();

      responseData = {
        totalEarnings: seller.metrics.totalRevenue,
        balance: seller.pointsBalance,
        transactions: seller.pointsHistory,
        paymentMethods: paymentIntegrations.map((integration) => ({
          type: integration.providerName,
          label: integration.providerName,
          fields: integration.autoRegister?.fields || [],
          verified: false, // يمكن تحديث هذا بناءً على حالة التكامل
        })),
      };
    } else {
      return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Fetch earnings error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Server error',
      },
      { status: 500 }
    );
  }
}