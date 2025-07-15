// app/api/subscriptions/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import SubscriptionPlan from '@/lib/db/models/subscription-plan.model';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import mongoose from 'mongoose';
// import { sendNotification } from '@/lib/utils/notifications';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import { sendNotification } from '@/lib/utils/notification';

const updateSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  pointsToRedeem: z.number().min(0).optional(),
  paymentMethodId: z.string().optional(), // ID تكامل الدفع بدل السوابت
  paymentDetails: z
    .object({
      cardNumber: z.string().optional(),
      expiry: z.string().optional(),
      cvc: z.string().optional(),
      paypalEmail: z.string().email().optional(),
      token: z.string().optional(), // لدعم توكنات الدفع
    })
    .optional(),
  dropshippingIntegrations: z.array(z.string()).optional(), // دعم تكاملات دروبشيبينغ
});

export async function POST(req: NextRequest) {
  const locale = req.nextUrl.searchParams.get('locale') || 'en';
  const t = await getTranslations({ locale, namespace: 'seller.subscriptions' });
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: t('errors.unauthorized') },
      { status: 401 }
    );
  }

  try {
    await connectToDatabase();

    const body = await req.json();
    const validatedData = updateSubscriptionSchema.parse(body);

    const sessionDb = await mongoose.startSession();
    sessionDb.startTransaction();

    try {
      const seller = await Seller.findOne({ userId: session.user.id }).session(sessionDb);
      if (!seller) {
        throw new Error(t('errors.sellerNotFound'));
      }

      const plan = await SubscriptionPlan.findOne({ id: validatedData.planId, isActive: true }).session(sessionDb);
      if (!plan) {
        throw new Error(t('errors.planNotFound'));
      }

      // التحقق من النقاط إذا كانت طريقة الدفع هي النقاط
      if (validatedData.paymentMethodId === 'points') {
        const pointsRequired = validatedData.pointsToRedeem || plan.pointsCost;
        if (seller.pointsBalance < pointsRequired) {
          throw new Error(t('errors.insufficientPoints'));
        }
        seller.pointsBalance -= pointsRequired;
        seller.pointsHistory.push({
          amount: pointsRequired,
          type: 'debit',
          reason: `Redeemed for ${plan.name} subscription`,
          createdAt: new Date(),
        });
      }

      let paymentIntegration = null;
      if (validatedData.paymentMethodId && validatedData.paymentMethodId !== 'points') {
        const integration = await Integration.findOne({ _id: validatedData.paymentMethodId, type: 'payment' }).session(sessionDb);
        if (!integration) {
          throw new Error(t('errors.paymentIntegrationNotFound'));
        }

        const sellerIntegration = await SellerIntegration.findOne({
          sellerId: seller._id,
          integrationId: integration._id,
          isActive: true,
          status: 'connected',
        }).session(sessionDb);
        if (!sellerIntegration) {
          throw new Error(t('errors.paymentIntegrationNotConnected'));
        }

        // التحقق من تفعيل الحساب البنكي لبوابة mgpay
        if (integration.providerName === 'mgpay' && !seller.bankInfo?.verified) {
          throw new Error(t('errors.bankNotVerified'));
        }

        paymentIntegration = integration;
        const paymentService = new GenericIntegrationService(integration, sellerIntegration);
        const paymentResponse = await paymentService.callApi({
          endpoint: integration.settings.endpoints?.createPayment || '/payments',
          method: 'POST',
          body: {
            amount: plan.price,
            currency: plan.currency || 'USD',
            source: validatedData.paymentDetails?.token,
            description: `Subscription payment for ${plan.name}`,
            metadata: { sellerId: seller._id, planId: plan.id },
          },
        });

        if (!paymentResponse.success) {
          throw new Error(t('errors.paymentFailed'));
        }
      }

      let dropshippingFees = 0;
      if (validatedData.dropshippingIntegrations?.length) {
        const dropshippingIntegrations = await Integration.find({
          _id: { $in: validatedData.dropshippingIntegrations },
          type: 'dropshipping',
        }).session(sessionDb);
        dropshippingFees = dropshippingIntegrations.reduce((sum, int) => sum + (int.settings.fee || 0), 0);
      }

      seller.subscription = {
        ...seller.subscription,
        plan: plan.name,
        planId: plan.id,
        price: plan.price + dropshippingFees,
        pointsCost: plan.pointsCost,
        status: 'active',
        startDate: new Date(),
        endDate: plan.isTrial ? new Date(Date.now() + (plan.trialDuration || 0) * 24 * 60 * 60 * 1000) : undefined,
        isTrial: plan.isTrial,
        trialDuration: plan.trialDuration,
        features: plan.features,
        paymentMethodId: validatedData.paymentMethodId,
        paymentDetails: validatedData.paymentDetails,
        pointsRedeemed: validatedData.pointsToRedeem || 0,
        updatedBy: session.user.id,
        dropshippingIntegrations: validatedData.dropshippingIntegrations || [],
      };

      await seller.save({ session: sessionDb });

      await sessionDb.commitTransaction();

      await sendNotification({
        userId: session.user.id,
        type: 'subscription_updated',
        title: t('messages.subscriptionUpdatedTitle'),
        message: t('messages.subscriptionUpdatedMessage', { plan: plan.name }),
        data: { planId: plan.id, sellerId: seller._id },
        channels: ['in_app', 'email'],
      });

      return NextResponse.json({
        success: true,
        message: t('success.update'),
        data: seller.subscription,
      });
    } catch (error) {
      await sessionDb.abortTransaction();
      throw error;
    } finally {
      sessionDb.endSession();
    }
  } catch (error) {
    console.error('Error updating subscription:', error);
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
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : t('error.server'),
      },
      { status: 500 }
    );
  }
}