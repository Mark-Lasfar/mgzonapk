import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import SubscriptionPlan from '@/lib/db/models/subscription-plan.model';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import mongoose from 'mongoose';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const locale = req.nextUrl.searchParams.get('locale') || 'en';
  const t = await getTranslations({ locale, namespace: 'admin.subscriptions' });
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'Admin') {
    return NextResponse.json({ success: false, message: t('errors.unauthorized') }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const sessionDb = await mongoose.startSession();
    sessionDb.startTransaction();
    try {
      const plan = await SubscriptionPlan.findOne({ id: params.id }).session(sessionDb);
      if (!plan) {
        throw new Error(t('errors.planNotFound'));
      }

      await SubscriptionPlan.updateOne({ id: params.id }, { isActive: false });

      await sessionDb.commitTransaction();
      return NextResponse.json({ success: true, message: t('success.delete') });
    } catch (error) {
      await sessionDb.abortTransaction();
      throw error;
    } finally {
      sessionDb.endSession();
    }
  } catch (error: unknown) {
    console.error('Error deleting subscription plan:', error);
    const message = error instanceof Error ? error.message : t('errors.server');
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}