// /app/api/seller/get/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSellerByUserId } from '@/lib/actions/seller.actions';
import { getLocale } from 'next-intl/server';

export async function GET(req: NextRequest) {
  try {
    const locale = await getLocale();
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const result = await getSellerByUserId(session.user.id, locale);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}