'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import WithdrawalRequest from '@/lib/db/models/withdrawal-request.model';
import Seller from '@/lib/db/models/seller.model';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/api/services/logging';
import { ObservabilityService } from '@/lib/api/services/observability';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { pusher } from '@/lib/api/services/pusher';

// Validation schema for updating withdrawal requests
const updateSchema = z.object({
  id: z.string().min(1, 'Withdrawal ID is required'),
  status: z.enum(['pending', 'approved', 'rejected'], {
    errorMap: () => ({ message: 'Invalid status' }),
  }),
  paymentMethod: z.enum(['bank_transfer', 'stripe', 'paypal']).optional(),
  adminNotes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export async function GET(req: NextRequest, { params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'admin.withdrawals' });
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      logger.error('Unauthorized access attempt to withdrawals', {
        url: req.url,
        userId: session?.user?.id,
      });
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 403 }
      );
    }

    await connectToDatabase();
    const withdrawals = await WithdrawalRequest.find()
      .populate({
        path: 'sellerId',
        select: 'businessName email',
        model: Seller,
      })
      .lean();

    logger.info('Withdrawals retrieved successfully', {
      count: withdrawals.length,
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: withdrawals });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to retrieve withdrawals', {
      error: errorMessage,
      url: req.url,
      userId: session?.user?.id,
    });
    return NextResponse.json(
      { success: false, message: t('errors.serverError') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { locale: string } }) {
  const t = await getTranslations({ locale: params.locale, namespace: 'admin.withdrawals' });
  const observabilityService = ObservabilityService.getInstance();
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'Admin') {
      logger.error('Unauthorized access attempt to update withdrawal', {
        url: req.url,
        userId: session?.user?.id,
      });
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsedData = updateSchema.safeParse(body);
    if (!parsedData.success) {
      logger.error('Invalid request body for withdrawal update', {
        errors: parsedData.error.issues,
        userId: session.user.id,
      });
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: parsedData.error.issues,
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const withdrawal = await WithdrawalRequest.findById(parsedData.data.id);
    if (!withdrawal) {
      logger.error('Withdrawal request not found', {
        withdrawalId: parsedData.data.id,
        userId: session.user.id,
      });
      return NextResponse.json(
        { success: false, message: t('errors.withdrawalNotFound') },
        { status: 404 }
      );
    }

    const seller = await Seller.findById(withdrawal.sellerId);
    if (!seller) {
      logger.error('Seller not found for withdrawal', {
        sellerId: withdrawal.sellerId,
        withdrawalId: parsedData.data.id,
        userId: session.user.id,
      });
      return NextResponse.json(
        { success: false, message: t('errors.sellerNotFound') },
        { status: 404 }
      );
    }

    if (parsedData.data.status === 'approved' && withdrawal.status !== 'approved') {
      if (seller.pointsBalance < withdrawal.amount) {
        logger.error('Insufficient points balance for withdrawal', {
          sellerId: seller._id,
          withdrawalId: withdrawal._id,
          pointsBalance: seller.pointsBalance,
          withdrawalAmount: withdrawal.amount,
          userId: session.user.id,
        });
        return NextResponse.json(
          {
            success: false,
            message: t('errors.insufficientBalance'),
          },
          { status: 400 }
        );
      }

      // Validate payment method compatibility
      if (parsedData.data.paymentMethod) {
        if (
          parsedData.data.paymentMethod === 'bank_transfer' &&
          !seller.bankInfo?.verified
        ) {
          logger.error('Unverified bank info for bank transfer', {
            sellerId: seller._id,
            withdrawalId: withdrawal._id,
            userId: session.user.id,
          });
          return NextResponse.json(
            {
              success: false,
              message: t('errors.unverifiedBankInfo'),
            },
            { status: 400 }
          );
        }
        if (
          parsedData.data.paymentMethod === 'stripe' &&
          !seller.stripeAccountId
        ) {
          logger.error('No Stripe account for withdrawal', {
            sellerId: seller._id,
            withdrawalId: withdrawal._id,
            userId: session.user.id,
          });
          return NextResponse.json(
            {
              success: false,
              message: t('errors.noStripeAccount'),
            },
            { status: 400 }
          );
        }
      }

      // Update seller points
      await seller.addPoints(-withdrawal.amount, `Withdrawal approved: ${withdrawal._id}`);
    }

    // Update withdrawal
    withdrawal.status = parsedData.data.status;
    if (parsedData.data.paymentMethod) {
      withdrawal.paymentMethod = parsedData.data.paymentMethod;
    }
    if (parsedData.data.adminNotes) {
      withdrawal.adminNotes = parsedData.data.adminNotes;
    }
    withdrawal.updatedAt = new Date();
    await withdrawal.save();

    // Record metrics
    await observabilityService.recordMetric({
      name: 'withdrawal.updated',
      value: 1,
      timestamp: new Date(),
      tags: { status: parsedData.data.status, paymentMethod: parsedData.data.paymentMethod || 'none' },
    });

    // Dispatch webhook
    await WebhookDispatcher.dispatch(seller.userId, 'withdrawal.updated', {
      withdrawalId: withdrawal._id,
      status: withdrawal.status,
      amount: withdrawal.amount,
      paymentMethod: withdrawal.paymentMethod,
      adminNotes: withdrawal.adminNotes,
      updatedBy: session.user.id,
    });

    // Trigger Pusher event
    await pusher.trigger(`seller-${seller.userId}`, 'withdrawal-update', {
      withdrawalId: withdrawal._id,
      status: withdrawal.status,
      amount: withdrawal.amount,
      paymentMethod: withdrawal.paymentMethod,
      adminNotes: withdrawal.adminNotes,
      updatedAt: withdrawal.updatedAt,
    });

    logger.info('Withdrawal request updated successfully', {
      withdrawalId: withdrawal._id,
      status: withdrawal.status,
      sellerId: seller._id,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: t('withdrawalUpdated'),
      data: withdrawal,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update withdrawal', {
      error: errorMessage,
      url: req.url,
      userId: session?.user?.id,
    });
    await observabilityService.recordError({
      error: errorMessage,
      context: { withdrawalId: parsedData?.data?.id },
      timestamp: new Date(),
    });
    return NextResponse.json(
      { success: false, message: t('errors.serverError') },
      { status: 500 }
    );
  }
}