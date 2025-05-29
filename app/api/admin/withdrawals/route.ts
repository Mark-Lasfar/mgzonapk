'use server';

import { NextRequest, NextResponse } from 'next/server';
import { getTranslations } from 'next-intl/server';
import WithdrawalRequest from '@/lib/db/models/withdrawal-request.model';
import Seller from '@/lib/db/models/seller.model';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
  id: z.string().min(1, 'Withdrawal ID is required'),
  status: z.enum(['pending', 'approved', 'rejected'], {
    errorMap: () => ({ message: 'Invalid status' }),
  }),
  paymentMethod: z.enum(['bank_transfer', 'stripe', 'paypal']).optional(),
  adminNotes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
});

export async function GET(req: NextRequest) {
  try {
    const t = await getTranslations('admin.withdrawals').catch(() => ({
      errors: {
        unauthorized: 'You are not authorized to access this resource.',
        serverError: 'An unexpected server error occurred.',
      },
    }));
    const session = await auth();
    if (!session?.user?.role || session.user.role !== 'Admin') {
      return NextResponse.json(
        {
          success: false,
          message: t.errors?.unauthorized || 'Unauthorized',
        },
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

    return NextResponse.json({ success: true, data: withdrawals });
  } catch (error) {
    console.error('Get withdrawals error:', error);
    const t = await getTranslations('admin.withdrawals').catch(() => ({
      errors: { serverError: 'An unexpected server error occurred.' },
    }));
    return NextResponse.json(
      {
        success: false,
        message: t.errors?.serverError || 'Server error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const t = await getTranslations('admin.withdrawals').catch(() => ({
      errors: {
        unauthorized: 'You are not authorized to access this resource.',
        serverError: 'An unexpected server error occurred.',
        invalidData: 'Invalid request data.',
        withdrawalNotFound: 'Withdrawal request not found.',
        insufficientBalance: 'Insufficient points balance for withdrawal.',
      },
      withdrawalUpdated: 'Withdrawal request updated successfully.',
    }));
    const session = await auth();
    if (!session?.user?.role || session.user.role !== 'Admin') {
      return NextResponse.json(
        {
          success: false,
          message: t.errors?.unauthorized || 'Unauthorized',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsedData = updateSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        {
          success: false,
          message: t.errors?.invalidData || 'Invalid data',
          errors: parsedData.error.errors,
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const withdrawal = await WithdrawalRequest.findById(parsedData.data.id);
    if (!withdrawal) {
      return NextResponse.json(
        {
          success: false,
          message: t.errors?.withdrawalNotFound || 'Withdrawal not found',
        },
        { status: 404 }
      );
    }

    if (parsedData.data.status === 'approved' && withdrawal.status !== 'approved') {
      const seller = await Seller.findById(withdrawal.sellerId);
      if (!seller) {
        return NextResponse.json(
          {
            success: false,
            message: 'Seller not found',
          },
          { status: 404 }
        );
      }
      if (seller.pointsBalance < withdrawal.amount) {
        return NextResponse.json(
          {
            success: false,
            message: t.errors?.insufficientBalance || 'Insufficient points balance',
          },
          { status: 400 }
        );
      }
      seller.pointsBalance -= withdrawal.amount;
      seller.pointsTransactions.push({
        amount: withdrawal.amount,
        type: 'spend',
        description: `Withdrawal approved: ${withdrawal._id}`,
        createdAt: new Date(),
      });
      await seller.save();
    }

    withdrawal.status = parsedData.data.status;
    if (parsedData.data.paymentMethod) {
      withdrawal.paymentMethod = parsedData.data.paymentMethod;
    }
    if (parsedData.data.adminNotes) {
      withdrawal.adminNotes = parsedData.data.adminNotes;
    }
    withdrawal.updatedAt = new Date();
    await withdrawal.save();

    return NextResponse.json({
      success: true,
      message: t.withdrawalUpdated || 'Withdrawal updated',
      data: withdrawal,
    });
  } catch (error) {
    console.error('Update withdrawal error:', error);
    const t = await getTranslations('admin.withdrawals').catch(() => ({
      errors: { serverError: 'An unexpected server error occurred.' },
    }));
    return NextResponse.json(
      {
        success: false,
        message: t.errors?.serverError || 'Server error',
      },
      { status: 500 }
    );
  }
}