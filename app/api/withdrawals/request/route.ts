import { NextRequest, NextResponse } from 'next/server';
import WithdrawalRequest from '@/lib/db/models/withdrawal-request.model';
import Seller from '@/lib/db/models/seller.model';
import { connectToDatabase } from '@/lib/db';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTranslations, getLocale } from 'next-intl/server';
import SellerIntegration from '@/lib/db/models/seller-integration.model';

const requestSchema = z.object({
  amount: z.number().min(1, { message: 'amount.min' }),
  currency: z.string().min(3, { message: 'currency.invalid' }),
  paymentMethod: z.object({
    type: z.string(),
    accountDetails: z.record(z.string()),
  }),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsedData = requestSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid request data', errors: parsedData.error.errors },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const { amount, currency, paymentMethod } = parsedData.data;

    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      return NextResponse.json(
        { success: false, message: 'Seller not found' },
        { status: 404 }
      );
    }

    // التحقق من تفعيل الحساب البنكي لبوابة mgpay فقط
    if (paymentMethod.type === 'mgpay' && !seller.bankInfo?.verified) {
      return NextResponse.json(
        { success: false, message: 'Bank account not verified. Please complete your financial profile.' },
        { status: 403 }
      );
    }

    const gateway = seller.paymentGateways.find((gw) => gw.providerName.toLowerCase() === paymentMethod.type);
    if (!gateway) {
      return NextResponse.json(
        { success: false, message: 'Payment method not configured' },
        { status: 400 }
      );
    }

    // التحقق من حالة التكامل للبوابات الخارجية
    if (paymentMethod.type !== 'mgpay') {
      const sellerIntegration = await SellerIntegration.findOne({
        sellerId: seller._id,
        providerName: paymentMethod.type,
        isActive: true,
        status: 'connected',
      });
      if (!sellerIntegration) {
        return NextResponse.json(
          { success: false, message: 'Payment integration not connected' },
          { status: 400 }
        );
      }
    }

    // Check if mgpay integration requires account creation
    if (paymentMethod.type === 'mgpay' && !gateway.verified) {
      try {
        const mgpayResponse = await createMgpayAccount(seller);
        if (!mgpayResponse.success) {
          return NextResponse.json(
            { success: false, message: 'Failed to create mgpay account' },
            { status: 400 }
          );
        }
        gateway.accountDetails = mgpayResponse.accountDetails;
        gateway.verified = true;
        await seller.save();
      } catch (error) {
        console.error('Mgpay account creation error:', error);
        return NextResponse.json(
          { success: false, message: 'Failed to create mgpay account' },
          { status: 500 }
        );
      }
    }

    if (seller.pointsBalance < amount) {
      return NextResponse.json(
        { success: false, message: 'Insufficient points balance' },
        { status: 400 }
      );
    }

    const withdrawal = await WithdrawalRequest.create({
      sellerId: seller._id,
      amount,
      currency,
      paymentMethod,
      status: 'pending',
      createdAt: new Date(),
    });

    seller.pointsBalance -= amount;
    seller.pointsHistory.push({
      amount,
      type: 'debit',
      reason: `Withdrawal request via ${paymentMethod.type}`,
      createdAt: new Date(),
    });
    await seller.save();

    return NextResponse.json({ success: true, data: withdrawal });
  } catch (error) {
    console.error('Create withdrawal error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}

async function createMgpayAccount(seller: any) {
  // Simulate mgpay API call
  return {
    success: true,
    accountDetails: {
      accountId: `mgpay_${seller._id}`,
      atmAccessCode: Math.random().toString(36).substring(2, 10),
    },
  };
}