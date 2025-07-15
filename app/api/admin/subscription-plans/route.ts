import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import SubscriptionPlan from '@/lib/db/models/subscription-plan.model';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import mongoose from 'mongoose';

const subscriptionPlanSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(2).max(50),
  price: z.number().min(0),
  pointsCost: z.number().min(0),
  description: z.string().min(10).max(500),
  features: z.object({
    productsLimit: z.number().min(0),
    commission: z.number().min(0),
    prioritySupport: z.boolean(),
    instantPayouts: z.boolean(),
    customSectionsLimit: z.number().min(0),
    domainSupport: z.boolean(),
    domainRenewal: z.boolean(),
    pointsRedeemable: z.boolean(),
    dynamicPaymentGateways: z.boolean(),
    maxApiKeys: z.number().min(0),
  }),
  isTrial: z.boolean(),
  trialDuration: z.number().min(0).optional(),
  isActive: z.boolean(),
});

export async function GET(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') || 'en';
  const t = await getTranslations({ locale, namespace: 'admin subscriptions' });

  try {
    await connectToDatabase();
    const plans = await SubscriptionPlan.find({ isActive: true }).lean();
    console.log('Fetched plans:', plans);
    return NextResponse.json({
      success: true,
      data: plans.map(plan => ({
        id: plan._id.toString(),
        name: plan.name,
        price: plan.price,
        description: plan.description,
      })),
    });
  } catch (error: unknown) {
    console.error('Error fetching subscription plans:', error);
    const message = error instanceof Error ? error.message : t('errors.server');
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') || 'en ,ar , fr';
  const t = await getTranslations({ locale, namespace: 'admin subscriptions' });
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'Admin') {
    return NextResponse.json(
      { success: false, message: t('errors.unauthorized') },
      { status: 401 }
    );
  }

  try {
    await connectToDatabase();
    const body = await req.json();
    const validatedData = subscriptionPlanSchema.parse(body);

    const sessionDb = await mongoose.startSession();
    sessionDb.startTransaction();
    try {
      const existingPlan = await SubscriptionPlan.findOne({ id: validatedData.id }).session(sessionDb);
      if (existingPlan) {
        throw new Error(t('errors.planIdExists'));
      }

      await SubscriptionPlan.create({
        ...validatedData,
        createdBy: session.user.id,
        updatedBy: session.user.id,
      });

      await sessionDb.commitTransaction();
      return NextResponse.json({ success: true, message: t('success.create') });
    } catch (error) {
      await sessionDb.abortTransaction();
      throw error;
    } finally {
      sessionDb.endSession();
    }
  } catch (error: unknown) {
    console.error('Error creating subscription plan:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : t('errors.server');
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') || 'en';
  const t = await getTranslations({ locale, namespace: 'admin subscriptions' });
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'Admin') {
    return NextResponse.json(
      { success: false, message: t('errors.unauthorized') },
      { status: 401 }
    );
  }

  try {
    await connectToDatabase();
    const body = await req.json();
    const validatedData = subscriptionPlanSchema.parse(body);

    const sessionDb = await mongoose.startSession();
    sessionDb.startTransaction();
    try {
      const plan = await SubscriptionPlan.findOne({ id: validatedData.id }).session(sessionDb);
      if (!plan) {
        throw new Error(t('errors.planNotFound'));
      }

      await SubscriptionPlan.updateOne(
        { id: validatedData.id },
        { ...validatedData, updatedBy: session.user.id }
      );

      await sessionDb.commitTransaction();
      return NextResponse.json({ success: true, message: t('success.update') });
    } catch (error) {
      await sessionDb.abortTransaction();
      throw error;
    } finally {
      sessionDb.endSession();
    }
  } catch (error: unknown) {
    console.error('Error updating subscription plan:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : t('errors.server');
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') || 'en';
  const t = await getTranslations({ locale, namespace: 'admin subscriptions' });
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'Admin') {
    return NextResponse.json(
      { success: false, message: t('errors.unauthorized') },
      { status: 401 }
    );
  }

  try {
    await connectToDatabase();
    const { id } = z.object({ id: z.string().min(1) }).parse(await req.json());

    const sessionDb = await mongoose.startSession();
    sessionDb.startTransaction();
    try {
      const plan = await SubscriptionPlan.findOne({ id }).session(sessionDb);
      if (!plan) {
        throw new Error(t('errors.planNotFound'));
      }

      await SubscriptionPlan.updateOne({ id }, { isActive: false });

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
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}