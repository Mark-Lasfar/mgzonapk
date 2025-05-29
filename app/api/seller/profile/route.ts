import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSellerByUserId } from '@/lib/actions/seller.actions';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      return NextResponse.json(
        { success: false, message: 'غير مصرح' },
        { status: 401 }
      );
    }

    const sellerResponse = await getSellerByUserId(session.user.id);
    if (!sellerResponse.success) {
      return NextResponse.json(sellerResponse);
    }

    return NextResponse.json({
      success: true,
      data: {
        customSiteUrl: sellerResponse.data.customSiteUrl,
        businessName: sellerResponse.data.businessName,
      },
    });
  } catch (error) {
    console.error('خطأ في API:', error);
    return NextResponse.json(
      { success: false, message: 'خطأ داخلي في السيرفر' },
      { status: 500 }
    );
  }
}