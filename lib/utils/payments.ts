'use server';

import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import SubscriptionOrder from '@/lib/db/models/subscription-order.model';
import { getSubscriptionPlans } from '@/lib/constants';
import { initiatePayment, PaymentRequest, PaymentResponse, createPaymentService } from '@/lib/api/services/payment';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { customLogger } from '@/lib/services/logging';
import { Order } from '@/lib/db/models/order.model';

interface PaymentGatewayId {
  userId: string;
  planId?: string;
  orderId?: string;
  amount: number;
  currency: string;
  method: string;
  domainRenewal?: boolean;
  paymentGatewayId?: string;
  shippingOptionId?: string;
  discountCode?: string;
}

async function initializePayPalPayment(
  integration: any,
  sellerIntegration: any,
  paymentRequest: PaymentRequest
): Promise<PaymentResponse> {
  const paymentService = new GenericIntegrationService(integration, sellerIntegration);
  const response = await paymentService.callApi({
    endpoint: `${process.env.PAYPAL_API_URL}/v2/checkout/orders`,
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: paymentRequest.currency,
            value: paymentRequest.amount.toString(),
          },
          description: paymentRequest.description || 'Subscription payment',
        },
      ],
      payer: {
        email_address: paymentRequest.customer.email,
        name: { given_name: paymentRequest.customer.name },
      },
    },
  });

  if (!response.success || !response.data.links) {
    throw new Error('Failed to initialize PayPal payment');
  }

  const approvalUrl = response.data.links.find((link: any) => link.rel === 'approve')?.href;
  return {
    transactionId: response.data.id,
    paymentUrl: approvalUrl,
  };
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
}: PaymentGatewayId): Promise<string> {
  await connectToDatabase();

  try {
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new Error('Seller not found');
    }

    let integration = null;
    let sellerIntegration = null;

    // Check if a specific payment gateway is provided
    if (paymentGatewayId && method !== 'points') {
      const result = await createPaymentService(seller._id.toString(), paymentGatewayId);
      integration = result.integration;
      sellerIntegration = result.sellerIntegration;
    } else if (method === 'stripe') {
      // Default to Stripe if no gateway is specified
      integration = { providerName: 'stripe', settings: { endpoints: { createPayment: '/v1/payment_intents' } } };
      sellerIntegration = { status: 'connected', isActive: true };
    } else if (method === 'paypal') {
      // Default to PayPal if no gateway is specified
      integration = { providerName: 'paypal', settings: { endpoints: { createPayment: '/v2/checkout/orders' } } };
      sellerIntegration = { status: 'connected', isActive: true };
    } else {
      // Fallback to Stripe if no valid method is provided
      integration = { providerName: 'stripe', settings: { endpoints: { createPayment: '/v1/payment_intents' } } };
      sellerIntegration = { status: 'connected', isActive: true };
    }

    // Verify bank account only for mgpay
    if (integration.providerName === 'mgpay' && !seller.bankInfo?.verified && method !== 'points') {
      throw new Error('Bank information not verified for mgpay');
    }

    let finalAmount = amount;

    // Handle order payment (non-subscription)
    if (orderId) {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Apply shipping cost
      if (shippingOptionId) {
        const shippingOption = seller.shippingOptions.find((opt: any) => opt.id === shippingOptionId);
        if (!shippingOption) {
          throw new Error('Invalid shipping option');
        }
        finalAmount += shippingOption.shippingPrice;
      }

      // Apply discount
      if (discountCode) {
        const discount = seller.discountOffers.find((offer: any) => offer.code === discountCode && offer.isActive);
        if (!discount) {
          throw new Error('Invalid or inactive discount code');
        }
        if (discount.minPurchase && amount < discount.minPurchase) {
          throw new Error('Order amount below minimum for discount');
        }
        if (discount.discountType === 'percentage') {
          finalAmount -= (amount * discount.discountValue) / 100;
        } else {
          finalAmount -= discount.discountValue;
        }
      }
    }

    // Handle subscription payment
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

    let paymentResponse: PaymentResponse;
    if (method === 'paypal' && !paymentGatewayId) {
      paymentResponse = await initializePayPalPayment(integration, sellerIntegration, paymentRequest);
    } else {
      paymentResponse = await initiatePayment(seller._id.toString(), integration.providerName, paymentRequest);
    }

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

    // Handle subscription payment
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

        const { integration: paymentIntegration, sellerIntegration: paymentSellerIntegration, requestId } = await createPaymentService(seller._id.toString(), integration.providerName);
        const verification = await verifyPayment(paymentIntegration, paymentSellerIntegration, order.paymentResult?.id, requestId);
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

      // Send subscription confirmation email via API Route
      const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          to: seller.email,
          name: seller.businessName,
          plan: plan.id,
          amount: order.amount,
          currency: order.currency,
          email: seller.email,
        }),
      });

      if (!emailResponse.ok) {
        await customLogger.error('Failed to send subscription confirmation email', {
          userId: seller.userId,
          orderId,
          error: await emailResponse.text(),
        });
        // Don't fail the transaction if email fails
      }

      await customLogger.info('Subscription payment processed', {
        userId: seller.userId,
        orderId,
        planId: plan.id,
        transactionId: order.paymentResult?.id,
      });
    } else {
      // Handle regular order payment
      order.status = 'paid';
      await order.save();

      // Send order payment confirmation email via API Route
      const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order',
          to: seller.email,
          name: seller.businessName,
          order: {
            _id: order._id.toString(),
            items: order.items || [],
            totalPrice: order.amount,
          },
        }),
      });

      if (!emailResponse.ok) {
        await customLogger.error('Failed to send order confirmation email', {
          userId: seller.userId,
          orderId,
          error: await emailResponse.text(),
        });
        // Don't fail the transaction if email fails
      }

      await customLogger.info('Order payment processed', {
        userId: seller.userId,
        orderId,
        transactionId: order.paymentResult?.id,
      });
    }

    // Update order as paid
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

    // Update order status to failed
    order.status = 'failed';
    await order.save();

    // Send payment failure email via API Route
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'payment_failed',
        to: seller.email,
        name: seller.businessName,
        order: {
          _id: order._id.toString(),
          items: order.items || [],
          totalPrice: order.amount,
        },
      }),
    });

    if (!emailResponse.ok) {
      await customLogger.error('Failed to send payment failure email', {
        userId: seller.userId,
        orderId,
        error: await emailResponse.text(),
      });
      // Don't fail the transaction if email fails
    }

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