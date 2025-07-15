import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import SubscriptionOrder from '@/lib/db/models/subscription-order.model';
// import Order from '@/lib/db/models/order.model';
import { emailService } from '@/lib/services/email/mailer';
import { getSubscriptionPlans } from '@/lib/constants';
import { PaymentService, PaymentRequest, PaymentResponse } from '../api/services/payment';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { customLogger } from '@/lib/services/logging';
import { randomUUID } from 'crypto';
import { Order } from '../db/models/order.model';

interface paymentGatewayId {
  userId: string;
  planId?: string;
  orderId?: string;
  amount: number;
  currency: string;
  method: string;
  domainRenewal?: boolean;
  paymentGatewayId: string;
  shippingOptionId?: string;
  discountCode?: string;
}

export async function createPaymentSession({
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
}: paymentGatewayId): Promise<string> {
  await connectToDatabase();

  try {
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new Error('Seller not found');
    }
    if (!seller.bankInfo?.verified && method !== 'points') {
      throw new Error('Bank information not verified');
    }

    let finalAmount = amount;

    // التحقق من الطلب (إذا كان دفعًا لطلب عادي وليس اشتراكًا)
    if (orderId) {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // تطبيق تكلفة الشحن
      if (shippingOptionId) {
        const shippingOption = seller.shippingOptions.find((opt: any) => opt._id.toString() === shippingOptionId);
        if (!shippingOption) {
          throw new Error('Invalid shipping option');
        }
        finalAmount += shippingOption.cost;
      }

      // تطبيق الخصم
      if (discountCode) {
        const discount = seller.discountOffers.find((offer: any) => offer.code === discountCode && offer.isActive);
        if (!discount) {
          throw new Error('Invalid or inactive discount code');
        }
        if (discount.minOrderValue && amount < discount.minOrderValue) {
          throw new Error('Order amount below minimum for discount');
        }
        if (discount.discountType === 'percentage') {
          finalAmount -= (amount * discount.discountValue) / 100;
        } else {
          finalAmount -= discount.discountValue;
        }
      }
    }

    // التحقق من الاشتراك (إذا كان دفعًا لاشتراك)
    if (planId) {
      const currentDate = new Date();
      if (
        seller.subscription.status === 'active' &&
        seller.subscription.endDate > currentDate &&
        seller.subscription.planId === planId
      ) {
        throw new Error('Seller already has an active subscription for this plan');
      }

      const plans = await getSubscriptionPlans();
      const plan = plans.find((p) => p.id === planId);
      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      if (method === 'points') {
        if (!plan.features.pointsRedeemable) {
          throw new Error('Points redemption not supported for this plan');
        }
        if (seller.pointsBalance < plan.pointsCost) {
          throw new Error('Insufficient points balance');
        }

        const order = await SubscriptionOrder.create({
          userId,
          planId,
          amount: 0,
          currency: 'POINTS',
          paymentMethod: 'points',
          isPaid: true,
          paidAt: new Date(),
          paymentGatewayId,
        });

        await handlePaymentSuccess(order._id.toString());
        return `${process.env.NEXT_PUBLIC_BASE_URL}/account/subscriptions?success=true`;
      }
    }

    const integration = await Integration.findOne({
      _id: paymentGatewayId,
      enabledBySellers: userId,
      type: 'payment',
      isActive: true,
      status: 'connected',
    });
    if (!integration) {
      throw new Error('Invalid or inactive payment integration');
    }

    const sellerIntegration = await SellerIntegration.findOne({
      sellerId: seller._id,
      integrationId: paymentGatewayId,
      status: 'connected',
      isActive: true,
    });
    if (!sellerIntegration) {
      throw new Error('No connected seller integration found');
    }

    const order = orderId
      ? await Order.findByIdAndUpdate(orderId, { paymentGatewayId, amount: finalAmount }, { new: true })
      : await SubscriptionOrder.create({
          userId,
          planId,
          amount: finalAmount,
          currency,
          paymentMethod: method,
          paymentGatewayId,
          isPaid: false,
        });

    const paymentService = new PaymentService(integration, sellerIntegration);
    const paymentRequest: PaymentRequest = {
      amount: finalAmount,
      currency,
      orderId: order._id.toString(),
      customer: {
        email: seller.email,
        name: seller.businessName,
        phone: seller.phone,
      },
      metadata: {
        userId,
        planId,
        domainRenewal: domainRenewal || false,
        shippingOptionId,
        discountCode,
      },
    };

    const paymentResponse: PaymentResponse = await paymentService.initiatePayment(paymentRequest);
    if (!paymentResponse.paymentUrl) {
      throw new Error('No payment URL returned from payment service');
    }

    await (orderId ? Order : SubscriptionOrder).findByIdAndUpdate(order._id, {
      paymentResult: { id: paymentResponse.transactionId },
    });

    await customLogger.info('Payment session created', {
      userId,
      orderId: order._id.toString(),
      provider: integration.providerName,
      transactionId: paymentResponse.transactionId,
    });

    return paymentResponse.paymentUrl;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await customLogger.error('Create payment session error', {
      userId,
      planId,
      method,
      error: errorMessage,
    });
    throw new Error(`Failed to create payment session: ${errorMessage}`);
  }
}

export async function handlePaymentSuccess(orderId: string): Promise<{
  success: boolean;
  data?: {
    type: 'subscription' | 'order';
    plan?: string;
    duration?: 'monthly' | 'yearly';
  };
  message?: string;
}> {
  await connectToDatabase();

  try {
    const order = await Order.findById(orderId) || await SubscriptionOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.isPaid) {
      return {
        success: true,
        data: {
          type: order.planId ? 'subscription' : 'order',
          plan: order.planId,
          duration: 'monthly',
        },
        message: 'Payment already processed',
      };
    }

    const seller = await Seller.findOne({ userId: order.userId });
    if (!seller) {
      throw new Error('Seller not found');
    }

    // التحقق من الدفع للاشتراكات
    if (order.planId) {
      const plans = await getSubscriptionPlans();
      const plan = plans.find((p) => p.id === order.planId);
      if (!plan) {
        throw new Error('Invalid plan ID');
      }

      if (order.paymentMethod !== 'points' && order.paymentGatewayId) {
        const integration = await Integration.findById(order.paymentGatewayId);
        const sellerIntegration = await SellerIntegration.findOne({
          sellerId: seller._id,
          integrationId: order.paymentGatewayId,
        });
        if (!integration || !sellerIntegration) {
          throw new Error('Payment integration not found');
        }

        const paymentService = new PaymentService(integration, sellerIntegration);
        const verification = await paymentService.verifyPayment(order.paymentResult?.id);
        if (verification.status !== 'completed') {
          throw new Error(`Payment verification failed: ${verification.status}`);
        }
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + (plan.isTrial ? plan.trialDuration! : 1));

      seller.subscription = {
        plan: plan.name,
        planId: plan.id,
        price: plan.price,
        pointsCost: plan.pointsCost,
        startDate,
        endDate,
        lastPaymentDate: new Date(),
        status: 'active',
        paymentMethod: order.paymentMethod,
        paymentGatewayId: order.paymentGatewayId,
        paymentId: order.paymentResult?.id,
        isTrial: plan.isTrial || false,
        trialDuration: plan.trialDuration,
        trialMonthsUsed: plan.isTrial ? (seller.subscription.trialMonthsUsed || 0) + plan.trialDuration! : 0,
        features: plan.features,
        pointsRedeemed: order.paymentMethod === 'points' ? plan.pointsCost : 0,
      };

      if (order.paymentMethod === 'points') {
        seller.pointsBalance -= plan.pointsCost;
        seller.pointsHistory.push({
          amount: plan.pointsCost,
          type: 'debit',
          reason: `Subscription redemption: ${plan.id}`,
          createdAt: new Date(),
        });
      }

      await seller.save();

      // إرسال إشعار نجاح الاشتراك
      await emailService.send({
        to: seller.email,
        template: 'subscription_updated',
        data: {
          businessName: seller.businessName,
          planName: plan.name,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });

      await customLogger.info('Subscription payment processed', {
        userId: seller.userId,
        orderId,
        planId: plan.id,
        transactionId: order.paymentResult?.id,
      });
    } else {
      // تحديث حالة الطلب العادي
      order.status = 'paid';
      await order.save();

      // إرسال إشعار نجاح الدفع
      await emailService.send({
        to: seller.email,
        template: 'payment_success',
        data: {
          businessName: seller.businessName,
          orderId,
          amount: order.amount,
          currency: order.currency,
        },
      });

      await customLogger.info('Order payment processed', {
        userId: seller.userId,
        orderId,
        transactionId: order.paymentResult?.id,
      });
    }

    // تحديث الطلب كمدفوع
    order.isPaid = true;
    order.paidAt = new Date();
    await order.save();

    return {
      success: true,
      data: {
        type: order.planId ? 'subscription' : 'order',
        plan: order.planId,
        duration: order.planId ? 'monthly' : undefined,
      },
      message: 'Payment processed successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await customLogger.error('Handle payment success error', {
      orderId,
      error: errorMessage,
    });
    throw new Error(`Failed to process payment: ${errorMessage}`);
  }
}

export async function handlePaymentFailure(orderId: string): Promise<{
  success: boolean;
  message?: string;
}> {
  await connectToDatabase();

  try {
    const order = await Order.findById(orderId) || await SubscriptionOrder.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const seller = await Seller.findOne({ userId: order.userId });
    if (!seller) {
      throw new Error('Seller not found');
    }

    // تحديث حالة الطلب إلى فشل
    order.status = 'failed';
    await order.save();

    // إرسال إشعار فشل الدفع
    await emailService.send({
      to: seller.email,
      template: 'payment_failed',
      data: {
        businessName: seller.businessName,
        orderId,
        amount: order.amount,
        currency: order.currency,
      },
    });

    await customLogger.error('Payment failed', {
      userId: seller.userId,
      orderId,
      transactionId: order.paymentResult?.id,
    });

    return {
      success: false,
      message: 'Payment failed',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await customLogger.error('Handle payment failure error', {
      orderId,
      error: errorMessage,
    });
    throw new Error(`Failed to process payment failure: ${errorMessage}`);
  }
}