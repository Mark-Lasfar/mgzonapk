import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Integration, { IIntegration } from '@/lib/db/models/integration.model';
import SellerIntegration, { ISellerIntegration } from '@/lib/db/models/seller-integration.model';
import Seller, { ISeller } from '@/lib/db/models/seller.model';
import { IOrder, Order } from '@/lib/db/models/order.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { getTranslations } from 'next-intl/server';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import { get } from 'lodash';
import { z } from 'zod';

// Zod Schema للتحقق من البيانات
const webhookPayloadSchema = z.object({
  event: z.enum([
    'order created',
    'order updated',
    'order fulfilled',
    'order cancelled',
    'order payment completed',
    'order shipment updated',
    'payment succeeded',
    'shipment updated',
    'tax transaction created',
    'tax report created',
    'product created',
    'product updated',
    'product deleted',
    'product imported',
    'product synced',
    'inventory updated',
    'customer created',
    'customer updated',
    'withdrawal created',
    'withdrawal updated',
    'seller registered',
    'seller updated',
    'campaign updated',
    'ad performance updated',
    'transaction recorded',
    'analytics updated',
    'automation triggered',
    'message sent',
    'course updated',
    'security alert',
    'string', // للسماح بالأحداث المخصصة لـ 'other'
  ]),
  payload: z.record(z.any()).optional(), // سمحت بأي بيانات إضافية
}).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; provider: string } }
) {
  const requestId = uuidv4();
  const t = await getTranslations('seller.integrations');
  try {
    const { id: sellerId, provider } = params; // تعريف provider من params
    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return NextResponse.json({ error: t('invalid_seller_id') }, { status: 400 });
    }

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return NextResponse.json({ error: t('seller_not_found') }, { status: 404 });
    }

    const integration = await Integration.findOne({ providerName: provider, sandbox });
    if (!integration || !integration.isActive) {
      return NextResponse.json({ error: t('integration_not_found') }, { status: 404 });
    }

    const sellerIntegration = await SellerIntegration.findOne({
      sellerId,
      integrationId: integration._id,
      sandbox,
    });

    if (!sellerIntegration || !sellerIntegration.isActive) {
      return NextResponse.json({ error: t('not_connected') }, { status: 404 });
    }

    if (!sellerIntegration.webhook?.enabled) {
      return NextResponse.json({ error: t('webhook_disabled') }, { status: 400 });
    }

    const payload = await req.json();
    // التحقق من تنسيق البيانات باستخدام Zod
    const validatedPayload = webhookPayloadSchema.parse(payload);

    const signature = req.headers.get('x-webhook-signature');
    const secret = sellerIntegration.webhook?.secret || '';

    if (secret && signature) {
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      if (computedSignature !== signature) {
        return NextResponse.json({ error: t('invalid_signature') }, { status: 400 });
      }
    }

    const mappedPayload = mapPayload(payload, integration.settings?.responseMapping);
    const integrationService = new GenericIntegrationService(integration, sellerIntegration);
    await processWebhook(integration, sellerIntegration, seller, mappedPayload, integrationService);

    logger.info('Webhook processed', { requestId, sellerId, provider });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const provider = params.provider || 'unknown'; // تهيئة provider بقيمة افتراضية إذا لم يكن موجودًا
    logger.error('Failed to process webhook', { requestId, Seller, provider, error: errorMessage });
    return NextResponse.json({ error: t('server_error') }, { status: 500 });
  }
}

function mapPayload(payload: any, mapping?: Map<string, string>): any {
  if (!mapping || mapping.size === 0) return payload;

  const mappedData: Record<string, any> = {};
  for (const [key, path] of mapping.entries()) {
    mappedData[key] = get(payload, path, null);
  }
  return mappedData;
}

async function processWebhook(
  integration: IIntegration,
  sellerIntegration: ISellerIntegration,
  seller: ISeller,
  payload: any,
  integrationService: GenericIntegrationService
) {
  const event = payload.event;
  switch (integration.type) {
    case 'payment':
      if (event === 'payment succeeded') {
        const order = await Order.findOne({
          sellerId: sellerIntegration.sellerId,
          paymentGatewayId: payload.paymentId,
        });
        if (order) {
          order.paymentStatus = 'successful';
          order.status = 'processing';
          order.escrowStatus = 'held';
          order.escrowDetails = {
            chargeId: payload.paymentId,
            releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          };
          order.integrations.push({
            providerId: integration._id,
            type: integration.type,
            providerName: integration.providerName,
            status: 'successful',
            metadata: payload,
          });
          await order.save();
          await WebhookDispatcher.dispatch(
            sellerIntegration.sellerId.toString(),
            'order payment completed',
            { orderId: order._id, paymentId: payload.paymentId }
          );
          logger.info('Payment webhook processed for seller', {
            orderId: order._id,
            sellerId: sellerIntegration.sellerId,
            paymentId: payload.paymentId,
          });
        }
      }
      break;
    case 'shipping':
      if (event === 'shipment updated') {
        const order = await Order.findOne({
          sellerId: sellerIntegration.sellerId,
          'trackingInfo.trackingNumber': payload.trackingId,
        });
        if (order) {
          order.fulfillmentStatus = payload.status || order.fulfillmentStatus;
          order.trackingInfo = {
            ...order.trackingInfo,
            status: payload.status,
            statusDetails: payload.statusDetails,
            lastUpdated: new Date().toISOString(),
            carrier: payload.carrier || order.trackingInfo?.carrier || '',
            trackingNumber: payload.trackingId || order.trackingInfo?.trackingNumber,
          };
          order.integrations.push({
            providerId: integration._id,
            type: integration.type,
            providerName: integration.providerName,
            status: payload.status,
            metadata: payload,
          });
          await order.save();
          await WebhookDispatcher.dispatch(
            sellerIntegration.sellerId.toString(),
            'order shipment updated',
            { orderId: order._id, trackingId: payload.trackingId }
          );
          logger.info('Shipping webhook processed for seller', {
            orderId: order._id,
            sellerId: sellerIntegration.sellerId,
            trackingId: payload.trackingId,
          });
        }
      }
      break;
    case 'tax':
      if (event === 'tax transaction created') {
        const order = await Order.findOne({
          sellerId: sellerIntegration.sellerId,
          _id: payload.orderId,
        });
        if (order) {
          order.taxDetails.transactionId = payload.transactionId;
          order.taxAmount = payload.taxAmount || order.taxAmount;
          order.taxDetails.taxType = payload.taxType || order.taxDetails.taxType;
          order.taxDetails.taxRate = payload.taxRate || order.taxDetails.taxRate;
          order.taxDetails.taxService = integration.providerName;
          order.integrations.push({
            providerId: integration._id,
            type: integration.type,
            providerName: integration.providerName,
            status: 'created',
            metadata: payload,
          });
          await order.save();
          await WebhookDispatcher.dispatch(
            sellerIntegration.sellerId.toString(),
            'tax transaction created',
            { orderId: order._id, transactionId: payload.transactionId }
          );
          logger.info('Tax webhook processed for seller', {
            orderId: order._id,
            sellerId: sellerIntegration.sellerId,
            transactionId: payload.transactionId,
          });
        }
      }
      break;
    case 'warehouse':
      if (event === 'inventory updated') {
        seller.metrics.products.outOfStock = payload.outOfStockCount || seller.metrics.products.outOfStock;
        seller.metrics.products.total = payload.totalCount || seller.metrics.products.total;
        await seller.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'inventory updated',
          { sellerId: seller._id, inventoryData: payload }
        );
        logger.info('Warehouse webhook processed for seller', {
          sellerId: seller._id,
          event: payload.event,
        });
      }
      break;
    case 'dropshipping':
      if (event === 'order fulfilled') {
        const order = await Order.findOne({
          sellerId: sellerIntegration.sellerId,
          _id: payload.orderId,
        });
        if (order) {
          order.fulfillmentStatus = 'fulfilled';
          order.status = 'completed';
          order.trackingInfo = {
            ...order.trackingInfo,
            trackingNumber: payload.trackingNumber,
            carrier: payload.carrier || '',
            lastUpdated: new Date().toISOString(),
          };
          order.integrations.push({
            providerId: integration._id,
            type: integration.type,
            providerName: integration.providerName,
            status: 'fulfilled',
            metadata: payload,
          });
          await order.save();
          await WebhookDispatcher.dispatch(
            sellerIntegration.sellerId.toString(),
            'order fulfilled',
            { orderId: order._id, trackingNumber: payload.trackingNumber }
          );
          logger.info('Dropshipping webhook processed for seller', {
            orderId: order._id,
            sellerId: sellerIntegration.sellerId,
            trackingNumber: payload.trackingNumber,
          });
        }
      }
      break;
    case 'marketplace':
      if (event === 'order created') {
        const order = new Order({
          sellerId: sellerIntegration.sellerId,
          externalOrderId: payload.orderId,
          items: payload.items,
          totalPrice: payload.totalPrice,
          currency: payload.currency || 'USD',
          status: 'pending',
          paymentStatus: 'pending',
          createdAt: new Date(),
          integrations: [
            {
              providerId: integration._id,
              type: integration.type,
              providerName: integration.providerName,
              externalOrderId: payload.orderId,
              status: 'pending',
              metadata: payload,
            },
          ],
        });
        await order.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'order created',
          { orderId: order._id, externalOrderId: payload.orderId }
        );
        logger.info('Marketplace webhook processed for seller', {
          orderId: order._id,
          sellerId: sellerIntegration.sellerId,
          externalOrderId: payload.orderId,
        });
      }
      break;
    case 'marketing':
    case 'advertising':
      if (event === 'campaign updated' || event === 'ad performance updated') {
        seller.metrics.views += payload.impressions || 0;
        seller.metrics.viewsHistory.push({ date: new Date() });
        await seller.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          event,
          { sellerId: seller._id, campaignId: payload.campaignId || payload.adId }
        );
        logger.info(`${integration.type} webhook processed for seller`, {
          sellerId: seller._id,
          campaignId: payload.campaignId || payload.adId,
        });
      }
      break;
    case 'accounting':
      if (event === 'transaction recorded') {
        seller.metrics.totalRevenue += payload.amount || 0;
        seller.metrics.totalSalesHistory.push({ amount: payload.amount, date: new Date() });
        await seller.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'transaction recorded',
          { sellerId: seller._id, transactionId: payload.transactionId }
        );
        logger.info('Accounting webhook processed for seller', {
          sellerId: seller._id,
          transactionId: payload.transactionId,
        });
      }
      break;
    case 'crm':
      if (event === 'customer updated') {
        seller.metrics.customersCount = payload.customerCount || seller.metrics.customersCount;
        await seller.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'customer updated',
          { sellerId: seller._id, customerId: payload.customerId }
        );
        logger.info('CRM webhook processed for seller', {
          sellerId: seller._id,
          customerId: payload.customerId,
        });
      }
      break;
    case 'analytics':
      if (event === 'analytics updated') {
        seller.metrics.views += payload.pageViews || 0;
        seller.metrics.viewsHistory.push({ date: new Date() });
        seller.metrics.customersCount = payload.uniqueVisitors || seller.metrics.customersCount;
        await seller.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'analytics updated',
          { sellerId: seller._id, analyticsData: payload }
        );
        logger.info('Analytics webhook processed for seller', {
          sellerId: seller._id,
          event: payload.event,
        });
      }
      break;
    case 'automation':
      if (event === 'automation triggered') {
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'automation triggered',
          { sellerId: seller._id, automationId: payload.automationId }
        );
        logger.info('Automation webhook processed for seller', {
          sellerId: seller._id,
          automationId: payload.automationId,
        });
      }
      break;
    case 'communication':
      if (event === 'message sent') {
        seller.metrics.customersCount = payload.recipientCount || seller.metrics.customersCount;
        await seller.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'message sent',
          { sellerId: seller._id, messageId: payload.messageId }
        );
        logger.info('Communication webhook processed for seller', {
          sellerId: seller._id,
          messageId: payload.messageId,
        });
      }
      break;
    case 'education':
      if (event === 'course updated') {
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'course updated',
          { sellerId: seller._id, courseId: payload.courseId }
        );
        logger.info('Education webhook processed for seller', {
          sellerId: seller._id,
          courseId: payload.courseId,
        });
      }
      break;
    case 'security':
      if (event === 'security alert') {
        seller.metrics.integrationErrors = seller.metrics.integrationErrors || [];
        seller.metrics.integrationErrors.push({
          providerName: integration.providerName,
          errorCode: payload.errorCode || 'SECURITY_ALERT',
          message: payload.message || 'Security alert received',
          timestamp: new Date(),
        });
        await seller.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'security alert',
          { sellerId: seller._id, alertId: payload.alertId }
        );
        logger.info('Security webhook processed for seller', {
          sellerId: seller._id,
          alertId: payload.alertId,
        });
      }
      break;
    case 'other':
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        `integration ${integration.providerName} custom`,
        { provider: integration.providerName, payload }
      );
      logger.info('Other webhook processed for seller', {
        sellerId: sellerIntegration.sellerId,
        event: payload.event,
      });
      break;
    default:
      logger.warn('Unsupported integration type', { type: integration.type });
  }

  if (payload.error) {
    await seller.logIntegrationError(integration.providerName, payload.errorCode || 'UNKNOWN', payload.error);
  }
}