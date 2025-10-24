// /home/mark/Music/my-nextjs-project-clean/app/api/withdrawals/request/route.ts

import { NextRequest, NextResponse } from 'next/server';
import WithdrawalRequest from '@/lib/db/models/withdrawal-request.model';
import Seller from '@/lib/db/models/seller.model';
import { Order } from '@/lib/db/models/order.model';
import { connectToDatabase } from '@/lib/db';
import { z } from 'zod';
import { auth } from '@/auth';
import { customLogger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import SellerIntegration from '@/lib/db/models/seller-integration.model';

// دالة إرسال الإشعارات (يجب أن تكون موجودة أو يتم تنفيذها)
async function sendNotification(notification: {
  userId: string;
  type: string;
  title: string;
  message: string;
  channels: string[];
  priority: string;
}) {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    });
  } catch (error) {
    customLogger.error('Failed_to_send_notification', { error: String(error), notification });
  }
}

const requestSchema = z.object({
  amount: z.number().min(10, { message: 'amount.min' }),
  currency: z.string().min(3, { message: 'currency.invalid' }),
  paymentMethod: z.object({
    type: z.string(),
    accountDetails: z.record(z.string(), z.string()),
  }),
});

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  try {
    const session = await auth();
    if (!session?.user?.id) {
      customLogger.warn('Unauthorized_access', { requestId });
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsedData = requestSchema.safeParse(body);
    if (!parsedData.success) {
      customLogger.warn('Invalid_request_data', { requestId, errors: parsedData.error.issues });
      return NextResponse.json(
        { success: false, message: 'Invalid request data', errors: parsedData.error.issues },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const { amount, currency, paymentMethod } = parsedData.data;

    const seller = await Seller.findOne({ userId: session.user.id });
    if (!seller) {
      customLogger.warn('Seller_not_found', { requestId, userId: session.user.id });
      return NextResponse.json({ success: false, message: 'Seller not found' }, { status: 404 });
    }

    // التحقق من الطلبات ذات المدفوعات المتأخرة
    const latePayments = await Order.find({
      sellerId: seller._id,
      status: 'pending_payment',
      createdAt: { $lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // المدفوعات المتأخرة أقدم من 7 أيام
    });

    if (latePayments.length > 0) {
      customLogger.warn('Late_payments_exist', {
        requestId,
        userId: session.user.id,
        latePayments: latePayments.length,
      });
      await sendNotification({
        userId: session.user.id,
        type: 'late_payment_blocked',
        title: 'Withdrawal Blocked Due to Late Payments',
        message: `Cannot process withdrawal due to ${latePayments.length} pending payment(s). Please resolve them first.`,
        channels: ['email', 'in_app'],
        priority: 'high',
      });
      return NextResponse.json(
        { success: false, message: 'Cannot withdraw while there are late payments' },
        { status: 400 }
      );
    }

    // التحقق من الطلبات المعلقة
    const pendingOrders = await Order.find({
      sellerId: seller._id,
      status: { $in: ['pending_supply', 'processing', 'shipped'] },
    });
    if (pendingOrders.length > 0) {
      customLogger.warn('Pending_orders_exist', { requestId, userId: session.user.id, pendingOrders: pendingOrders.length });
      await sendNotification({
        userId: session.user.id,
        type: 'pending_orders_blocked',
        title: 'Withdrawal Blocked Due to Pending Orders',
        message: 'Cannot process withdrawal due to pending orders.',
        channels: ['email', 'in_app'],
        priority: 'medium',
      });
      return NextResponse.json(
        { success: false, message: 'Cannot withdraw while there are pending orders' },
        { status: 400 }
      );
    }

    // التحقق من تفعيل الحساب البنكي لبوابة mgpay
    if (paymentMethod.type === 'mgpay' && !seller.bankInfo?.verified) {
      customLogger.warn('Bank_account_not_verified', { requestId, userId: session.user.id });
      return NextResponse.json(
        { success: false, message: 'Bank account not verified. Please complete your financial profile.' },
        { status: 403 }
      );
    }

    const gateway = seller.paymentGateways.find((gw: any) => gw.providerName.toLowerCase() === paymentMethod.type);
    if (!gateway) {
      customLogger.warn('Payment_method_not_configured', { requestId, userId: session.user.id, paymentMethod: paymentMethod.type });
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
        customLogger.warn('Payment_integration_not_connected', { requestId, userId: session.user.id, paymentMethod: paymentMethod.type });
        return NextResponse.json(
          { success: false, message: 'Payment integration not connected' },
          { status: 400 }
        );
      }
    }

    // التحقق من إنشاء حساب mgpay
    if (paymentMethod.type === 'mgpay' && !gateway.verified) {
      try {
        const mgpayResponse = await createMgpayAccount(seller);
        if (!mgpayResponse.success) {
          customLogger.warn('Failed_to_create_mgpay_account', { requestId, userId: session.user.id });
          return NextResponse.json(
            { success: false, message: 'Failed to create mgpay account' },
            { status: 400 }
          );
        }
        gateway.accountDetails = mgpayResponse.accountDetails;
        gateway.verified = true;
        await seller.save();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create mgpay account';
        customLogger.error('Mgpay_account_creation_error', { requestId, error: errorMessage });
        return NextResponse.json(
          { success: false, message: 'Failed to create mgpay account' },
          { status: 500 }
        );
      }
    }

    if (seller.pointsBalance < amount) {
      customLogger.warn('Insufficient_balance', { requestId, userId: session.user.id, amount });
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

    customLogger.info('Withdrawal_request_created', { requestId, withdrawalId: withdrawal._id });
    await sendNotification({
      userId: session.user.id,
      type: 'withdrawal_requested',
      title: 'Withdrawal Request Created',
      message: `Your withdrawal request of ${amount} ${currency} via ${paymentMethod.type} has been submitted.`,
      channels: ['email', 'in_app'],
      priority: 'medium',
    });

    return NextResponse.json({ success: true, data: withdrawal });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Server error';
    customLogger.error('Failed_to_create_withdrawal', { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}

async function createMgpayAccount(seller: any) {
  // محاكاة استدعاء API لـ mgpay
  const accountDetails = new Map<string, string>();
  accountDetails.set('accountId', `mgpay_${seller._id}`);
  accountDetails.set('atmAccessCode', Math.random().toString(36).substring(2, 10));
  return {
    success: true,
    accountDetails,
  };
}