import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTranslations, getLocale } from 'next-intl/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { assignDomain } from '@/lib/domainManager';
import { updateSellerSubscription } from '@/lib/actions/seller.actions';

export async function POST(req: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'subscriptions' });
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    const { plan } = await req.json();
    const userId = session.user.id;

    await connectToDatabase();
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      return NextResponse.json({ error: t('errors.sellerNotFound') }, { status: 404 });
    }

    const validPlans = ['trial', 'basic', 'pro', 'vip'];
    if (!validPlans.includes(plan)) {
      return NextResponse.json({ error: t('errors.invalidPlan') }, { status: 400 });
    }

    const result = await updateSellerSubscription(userId, { plan, paymentMethod: 'points' }, locale);
    if (!result.success) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
    }

    const domain = await assignDomain(userId, seller.businessName, plan);

    return NextResponse.json({ success: true, plan, domain });
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}