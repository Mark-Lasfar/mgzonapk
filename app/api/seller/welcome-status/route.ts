import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Seller from '@/lib/db/models/seller.model';
import { connectToDatabase } from '@/lib/db';
import { getTranslations } from 'next-intl/server';

export async function GET() {
  const t = await getTranslations('api');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    // Check if welcome dialog should be shown (e.g., new seller or trial just started)
    const showWelcome = !seller.settings.display.welcomeSeen && seller.freeTrial;

    return NextResponse.json({
      success: true,
      showWelcome,
    });
  } catch (error) {
    console.error('Welcome status error:', error);
    return NextResponse.json(
      { success: false, message: t('errors.internalServerError') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const t = await getTranslations('api');
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { seen } = body;

    if (typeof seen !== 'boolean') {
      return NextResponse.json(
        { success: false, message: t('errors.invalidRequest') },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const seller = await Seller.findOneAndUpdate(
      { userId: session.user.id },
      { 'settings.display.welcomeSeen': seen },
      { new: true }
    );

    if (!seller) {
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update welcome status error:', error);
    return NextResponse.json(
      { success: false, message: t('errors.internalServerError') },
      { status: 500 }
    );
  }
}