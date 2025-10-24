// /app/api/payment/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createPaymentSession } from '@/lib/utils/payments';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userId,
      planId,
      orderId,
      amount,
      currency,
      method,
      domainRenewal,
      paymentGatewayId,
      shippingOptionId,
      discountCode,
    } = body;

    // التحقق من الحقول المطلوبة
    if (!userId || !amount || !currency || !method || !paymentGatewayId) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const paymentUrl = await createPaymentSession({
      userId,
      planId,
      orderId,
      amount,
      currency,
      method,
      domainRenewal,
      paymentGatewayId,
      shippingOptionId,
      discountCode,
    });

    return NextResponse.json({ success: true, paymentUrl });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, message: `Failed to create payment session: ${errorMessage}` },
      { status: 500 }
    );
  }
}