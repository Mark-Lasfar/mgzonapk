import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import User from '@/lib/db/models/user.model';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { PaymentService, PaymentRequest } from '../api/services/payment';
import { sendNotification } from '@/lib/utils/notification';
import { customLogger } from '@/lib/services/logging';
import { randomUUID } from 'crypto';

interface PaymentOptions {
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentGatewayId: string;
  description: string;
}

export async function initiatePayment(options: PaymentOptions) {
  const { userId, amount, currency, paymentMethod, paymentGatewayId, description } = options;

  try {
    await connectToDatabase();
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new Error('Seller not found');
    }

    // التحقق من تفعيل الحساب البنكي لبوابة mgpay
    if (paymentGatewayId === 'mgpay' && !seller.bankInfo?.verified) {
      throw new Error('Bank account not verified. Please complete your financial profile.');
    }

    const user = await User.findById(userId).select('whatsapp').lean();
    const channels = user?.whatsapp ? ['email', 'in_app', 'whatsapp'] : ['email', 'in_app'];

    const integration = await Integration.findOne({
      _id: paymentGatewayId,
      enabledBySellers: userId,
      type: 'payment',
      isActive: true,
      status: 'connected',
    });

    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: seller._id,
      integrationId: paymentGatewayId,
      status: 'connected',
      isActive: true,
    });

    const providerName = integration ? integration.providerName : paymentGatewayId === 'mgpay' ? 'mgpay' : null;
    if (!providerName) {
      throw new Error('Invalid or inactive payment integration');
    }

    const paymentService = await PaymentService.createFromSellerId(seller._id.toString(), providerName);
    const paymentRequest: PaymentRequest = {
      amount,
      currency,
      orderId: randomUUID(),
      customer: {
        email: seller.email,
        name: seller.businessName,
        phone: seller.phone,
      },
      metadata: {
        userId,
        description,
      },
    };

    const paymentResponse = await paymentService.initiatePayment(paymentRequest);
    if (!paymentResponse.paymentUrl) {
      throw new Error('No payment URL returned');
    }

    await sendNotification({
      userId,
      type: 'payment.success',
      title: 'Payment Initiated',
      message: `Your payment of ${amount} ${currency} for ${description} has been initiated.`,
      channels,
      data: { amount, description },
    });

    await customLogger.info('Payment initiated', {
      userId,
      paymentMethod,
      paymentGatewayId,
      transactionId: paymentResponse.transactionId,
    });

    return { success: true, data: { redirectUrl: paymentResponse.paymentUrl } };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await customLogger.error('Payment initiation error', {
      userId,
      paymentMethod,
      paymentGatewayId,
      error: errorMessage,
    });
    return {
      success: false,
      message: errorMessage,
    };
  }
}