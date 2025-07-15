import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Integration, { IIntegration } from '@/lib/db/models/integration.model';
import SellerIntegration, { ISellerIntegration } from '@/lib/db/models/seller-integration.model';
import Seller, { ISeller } from '@/lib/db/models/seller.model';
import { Order } from '@/lib/db/models/order.model';
import Product from '@/lib/db/models/product.model';
import { logger } from '@/lib/api/services/logging';
import { v4 as uuidv4 } from 'uuid';
import { getTranslations } from 'next-intl/server';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import { get } from 'lodash';

// دالة مشتركة لمعالجة إنشاء أو استيراد المنتجات
async function handleProductCreateOrImport(
  integration: IIntegration,
  sellerIntegration: ISellerIntegration,
  seller: ISeller,
  payload: any,
  event: 'product created' | 'product imported'
) {
  const product = await Product.create({
    name: payload.name,
    slug: payload.slug || payload.name.toLowerCase().replace(/\s+/g, '-'),
    description: payload.description || 'No description provided',
    category: payload.category || 'Uncategorized',
    brand: payload.brand || 'Unknown',
    images: payload.images || [],
    price: payload.price || 0,
    listPrice: payload.listPrice || payload.price || 0,
    countInStock: payload.quantity || 0,
    sellerId: sellerIntegration.sellerId,
    warehouseData: [
      {
        provider: integration.providerName,
        warehouseId: payload.warehouseId,
        sku: payload.sku,
        quantity: payload.quantity || 0,
        location: payload.location,
        lastUpdated: new Date(),
      },
    ],
    status: 'pending',
    inventoryStatus: payload.quantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
    webhookEvents: [
      {
        event,
        providerId: integration._id,
        metadata: payload,
        timestamp: new Date(),
      },
    ],
  });
  await WebhookDispatcher.dispatch(
    sellerIntegration.sellerId.toString(),
    event,
    { productId: product._id, externalProductId: payload.productId }
  );
  logger.info(`${event} webhook processed`, {
    productId: product._id,
    sellerId: sellerIntegration.sellerId,
    externalProductId: payload.productId,
  });
}

// دالة مشتركة لمعالجة تحديث أو مزامنة المنتجات
async function handleProductUpdateOrSync(
  integration: IIntegration,
  sellerIntegration: ISellerIntegration,
  seller: ISeller,
  payload: any,
  event: 'product updated' | 'product synced'
) {
  const product = await Product.findOne({
    sellerId: sellerIntegration.sellerId,
    _id: payload.productId,
  });
  if (product) {
    product.name = payload.name || product.name;
    product.description = payload.description || product.description;
    product.price = payload.price || product.price;
    product.listPrice = payload.listPrice || product.listPrice;
    product.countInStock = payload.quantity || product.countInStock;
    product.inventoryStatus = payload.quantity > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';
    product.warehouseData = [
      ...(product.warehouseData || []),
      {
        provider: integration.providerName,
        warehouseId: payload.warehouseId,
        sku: payload.sku,
        quantity: payload.quantity || 0,
        location: payload.location,
        lastUpdated: new Date(),
      },
    ];
    product.webhookEvents.push({
      event,
      providerId: integration._id,
      metadata: payload,
      timestamp: new Date(),
    });
    await product.save();
    await WebhookDispatcher.dispatch(
      sellerIntegration.sellerId.toString(),
      event,
      { productId: product._id, externalProductId: payload.productId }
    );
    logger.info(`${event} webhook processed`, {
      productId: product._id,
      sellerId: sellerIntegration.sellerId,
      externalProductId: payload.productId,
    });
  }
}

// تعريف تعيين الأحداث إلى الإجراءات
const eventHandlers: Record<
  string,
  {
    types: string[];
    handler: (
      integration: IIntegration,
      sellerIntegration: ISellerIntegration,
      seller: ISeller,
      payload: any,
      integrationService: GenericIntegrationService
    ) => Promise<void>;
  }
> = {
  'order created': {
    types: ['marketplace'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
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
      logger.info('Order created webhook processed', {
        orderId: order._id,
        sellerId: sellerIntegration.sellerId,
        externalOrderId: payload.orderId,
      });
    },
  },
  'order fulfilled': {
    types: ['dropshipping', 'marketplace'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
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
        logger.info('Order fulfilled webhook processed', {
          orderId: order._id,
          sellerId: sellerIntegration.sellerId,
          trackingNumber: payload.trackingNumber,
        });
      }
    },
  },
  'order cancelled': {
    types: ['marketplace'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      const order = await Order.findOne({
        sellerId: sellerIntegration.sellerId,
        _id: payload.orderId,
      });
      if (order) {
        order.status = 'cancelled';
        order.integrations.push({
          providerId: integration._id,
          type: integration.type,
          providerName: integration.providerName,
          status: 'cancelled',
          metadata: payload,
        });
        await order.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'order cancelled',
          { orderId: order._id, externalOrderId: payload.orderId }
        );
        logger.info('Order cancelled webhook processed', {
          orderId: order._id,
          sellerId: sellerIntegration.sellerId,
          externalOrderId: payload.orderId,
        });
      }
    },
  },
  'order payment completed': {
    types: ['payment'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
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
        logger.info('Payment completed webhook processed', {
          orderId: order._id,
          sellerId: sellerIntegration.sellerId,
          paymentId: payload.paymentId,
        });
      }
    },
  },
  'order shipment updated': {
    types: ['shipping'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
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
        logger.info('Shipment updated webhook processed', {
          orderId: order._id,
          sellerId: sellerIntegration.sellerId,
          trackingId: payload.trackingId,
        });
      }
    },
  },
  'order updated': {
    types: ['marketplace'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      const order = await Order.findOne({
        sellerId: sellerIntegration.sellerId,
        _id: payload.orderId,
      });
      if (order) {
        order.status = payload.status || order.status;
        order.totalPrice = payload.totalPrice || order.totalPrice;
        order.items = payload.items || order.items;
        order.integrations.push({
          providerId: integration._id,
          type: integration.type,
          providerName: integration.providerName,
          status: payload.status || 'updated',
          metadata: payload,
        });
        await order.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'order updated',
          { orderId: order._id, externalOrderId: payload.orderId }
        );
        logger.info('Order updated webhook processed', {
          orderId: order._id,
          sellerId: sellerIntegration.sellerId,
          externalOrderId: payload.orderId,
        });
      }
    },
  },
  'payment succeeded': {
    types: ['payment'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
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
        logger.info('Payment succeeded webhook processed', {
          orderId: order._id,
          sellerId: sellerIntegration.sellerId,
          paymentId: payload.paymentId,
        });
      }
    },
  },
  'shipment updated': {
    types: ['shipping'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
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
        logger.info('Shipment updated webhook processed', {
          orderId: order._id,
          sellerId: sellerIntegration.sellerId,
          trackingId: payload.trackingId,
        });
      }
    },
  },
  'tax transaction created': {
    types: ['tax'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
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
        logger.info('Tax transaction created webhook processed', {
          orderId: order._id,
          sellerId: sellerIntegration.sellerId,
          transactionId: payload.transactionId,
        });
      }
    },
  },
  'tax report created': {
    types: ['tax'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      const validTaxServices = ['TaxJar', 'Avalara', 'Quaderno', 'none'];
      const taxService = validTaxServices.includes(integration.providerName)
        ? integration.providerName as 'TaxJar' | 'Avalara' | 'Quaderno' | 'none'
        : 'none';
      seller.taxSettings[payload.countryCode] = {
        countryCode: payload.countryCode,
        taxType: payload.taxType || 'none',
        taxRate: payload.taxRate || 0,
        taxService,
      };
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'tax report created',
        { sellerId: seller._id, reportId: payload.reportId }
      );
      logger.info('Tax report created webhook processed', {
        sellerId: seller._id,
        reportId: payload.reportId,
      });
    },
  },
  'product created': {
    types: ['marketplace', 'warehouse', 'dropshipping'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      await handleProductCreateOrImport(integration, sellerIntegration, seller, payload, 'product created');
    },
  },
  'product updated': {
    types: ['marketplace', 'warehouse', 'dropshipping'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      await handleProductUpdateOrSync(integration, sellerIntegration, seller, payload, 'product updated');
    },
  },
  'product deleted': {
    types: ['marketplace', 'warehouse', 'dropshipping'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      const product = await Product.findOne({
        sellerId: sellerIntegration.sellerId,
        _id: payload.productId,
      });
      if (product) {
        product.status = 'suspended';
        product.isPublished = false;
        product.webhookEvents.push({
          event: 'product deleted',
          providerId: integration._id,
          metadata: payload,
          timestamp: new Date(),
        });
        await product.save();
        await WebhookDispatcher.dispatch(
          sellerIntegration.sellerId.toString(),
          'product deleted',
          { productId: product._id, externalProductId: payload.productId }
        );
        logger.info('Product deleted webhook processed', {
          productId: product._id,
          sellerId: sellerIntegration.sellerId,
          externalProductId: payload.productId,
        });
      }
    },
  },
  'product imported': {
    types: ['marketplace', 'warehouse', 'dropshipping'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      await handleProductCreateOrImport(integration, sellerIntegration, seller, payload, 'product imported');
    },
  },
  'product synced': {
    types: ['marketplace', 'warehouse', 'dropshipping'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      await handleProductUpdateOrSync(integration, sellerIntegration, seller, payload, 'product synced');
    },
  },
  'inventory updated': {
    types: ['warehouse'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.metrics.products.outOfStock = payload.outOfStockCount || seller.metrics.products.outOfStock;
      seller.metrics.products.total = payload.totalCount || seller.metrics.products.total;
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'inventory updated',
        { sellerId: seller._id, inventoryData: payload }
      );
      logger.info('Inventory updated webhook processed', {
        sellerId: seller._id,
        event: payload.event,
      });
    },
  },
  'customer created': {
    types: ['crm'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.metrics.customersCount = (seller.metrics.customersCount || 0) + 1;
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'customer created',
        { sellerId: seller._id, customerId: payload.customerId }
      );
      logger.info('Customer created webhook processed', {
        sellerId: seller._id,
        customerId: payload.customerId,
      });
    },
  },
  'customer updated': {
    types: ['crm'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.metrics.customersCount = payload.customerCount || seller.metrics.customersCount;
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'customer updated',
        { sellerId: seller._id, customerId: payload.customerId }
      );
      logger.info('Customer updated webhook processed', {
        sellerId: seller._id,
        customerId: payload.customerId,
      });
    },
  },
  'withdrawal created': {
    types: ['payment'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.metrics.totalRevenue -= payload.amount || 0;
      seller.pointsHistory.push({
        amount: payload.amount,
        type: 'debit',
        reason: 'withdrawal',
        createdAt: new Date(),
      });
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'withdrawal created',
        { sellerId: seller._id, withdrawalId: payload.withdrawalId }
      );
      logger.info('Withdrawal created webhook processed', {
        sellerId: seller._id,
        withdrawalId: payload.withdrawalId,
      });
    },
  },
  'withdrawal updated': {
    types: ['payment'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'withdrawal updated',
        { sellerId: seller._id, withdrawalId: payload.withdrawalId, status: payload.status }
      );
      logger.info('Withdrawal updated webhook processed', {
        sellerId: seller._id,
        withdrawalId: payload.withdrawalId,
      });
    },
  },
  'seller registered': {
    types: ['marketplace', 'other'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.status = 'active';
      seller.integrations[payload.providerName] = {
        providerName: integration.providerName,
        type: integration.type,
        isActive: true,
        connectedAt: new Date(),
        lastUpdatedAt: new Date(),
        metadata: payload,
      };
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'seller registered',
        { sellerId: seller._id, providerName: integration.providerName }
      );
      logger.info('Seller registered webhook processed', {
        sellerId: seller._id,
        providerName: integration.providerName,
      });
    },
  },
  'seller updated': {
    types: ['marketplace', 'other'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.businessName = payload.businessName || seller.businessName;
      seller.email = payload.email || seller.email;
      seller.phone = payload.phone || seller.phone;
      seller.integrations[payload.providerName] = {
        ...seller.integrations[payload.providerName],
        metadata: payload,
        lastUpdatedAt: new Date(),
      };
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'seller updated',
        { sellerId: seller._id, providerName: integration.providerName }
      );
      logger.info('Seller updated webhook processed', {
        sellerId: seller._id,
        providerName: integration.providerName,
      });
    },
  },
  'campaign updated': {
    types: ['marketing', 'advertising'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.metrics.views += payload.impressions || 0;
      seller.metrics.viewsHistory.push({ date: new Date() });
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'campaign updated',
        { sellerId: seller._id, campaignId: payload.campaignId }
      );
      logger.info('Campaign updated webhook processed', {
        sellerId: seller._id,
        campaignId: payload.campaignId,
      });
    },
  },
  'ad performance updated': {
    types: ['marketing', 'advertising'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.metrics.views += payload.impressions || 0;
      seller.metrics.viewsHistory.push({ date: new Date() });
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'ad performance updated',
        { sellerId: seller._id, adId: payload.adId }
      );
      logger.info('Ad performance updated webhook processed', {
        sellerId: seller._id,
        adId: payload.adId,
      });
    },
  },
  'transaction recorded': {
    types: ['accounting'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.metrics.totalRevenue += payload.amount || 0;
      seller.metrics.totalSalesHistory.push({ amount: payload.amount, date: new Date() });
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'transaction recorded',
        { sellerId: seller._id, transactionId: payload.transactionId }
      );
      logger.info('Transaction recorded webhook processed', {
        sellerId: seller._id,
        transactionId: payload.transactionId,
      });
    },
  },
  'analytics updated': {
    types: ['analytics'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.metrics.views += payload.pageViews || 0;
      seller.metrics.viewsHistory.push({ date: new Date() });
      seller.metrics.customersCount = payload.uniqueVisitors || seller.metrics.customersCount;
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'analytics updated',
        { sellerId: seller._id, analyticsData: payload }
      );
      logger.info('Analytics updated webhook processed', {
        sellerId: seller._id,
        event: payload.event,
      });
    },
  },
  'automation triggered': {
    types: ['automation'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'automation triggered',
        { sellerId: seller._id, automationId: payload.automationId }
      );
      logger.info('Automation triggered webhook processed', {
        sellerId: seller._id,
        automationId: payload.automationId,
      });
    },
  },
  'message sent': {
    types: ['communication'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      seller.metrics.customersCount = payload.recipientCount || seller.metrics.customersCount;
      await seller.save();
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'message sent',
        { sellerId: seller._id, messageId: payload.messageId }
      );
      logger.info('Message sent webhook processed', {
        sellerId: seller._id,
        messageId: payload.messageId,
      });
    },
  },
  'course updated': {
    types: ['education'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        'course updated',
        { sellerId: seller._id, courseId: payload.courseId }
      );
      logger.info('Course updated webhook processed', {
        sellerId: seller._id,
        courseId: payload.courseId,
      });
    },
  },
  'security alert': {
    types: ['security'],
    handler: async (integration, sellerIntegration, seller, payload, integrationService) => {
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
      logger.info('Security alert webhook processed', {
        sellerId: seller._id,
        alertId: payload.alertId,
      });
    },
  },
};

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('webhooks.integrations');
  try {
    const { searchParams } = new URL(req.url);
    const sandbox = searchParams.get('sandbox') === 'true';
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json({ error: t('provider_required') }, { status: 400 });
    }

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const integration = await Integration.findOne({ providerName: provider });
    if (!integration || !integration.isActive) {
      return NextResponse.json({ error: t('integration_not_found') }, { status: 404 });
    }

    const payload = await req.json();
    const signature = req.headers.get('x-webhook-signature');
    const secret = integration.webhook?.secret || '';

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
    const sellerIntegrations = await SellerIntegration.find({
      integrationId: integration._id,
      isActive: true,
      sandbox,
    });

    for (const sellerIntegration of sellerIntegrations) {
      const seller = await Seller.findById(sellerIntegration.sellerId);
      if (!seller) continue;

      const integrationService = new GenericIntegrationService(integration, sellerIntegration);
      await processWebhook(integration, sellerIntegration, seller, mappedPayload, integrationService);
    }

    logger.info('Generic webhook processed', {
      requestId,
      provider: integration.providerName,
      event: mappedPayload.event,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to process generic webhook', { requestId, error: errorMessage });
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
  const handler = eventHandlers[event];

  if (!handler) {
    if (integration.type === 'other') {
      await WebhookDispatcher.dispatch(
        sellerIntegration.sellerId.toString(),
        `integration ${integration.providerName} custom`,
        { provider: integration.providerName, payload }
      );
      logger.info('Custom webhook processed for "other" integration', {
        sellerId: sellerIntegration.sellerId,
        event,
      });
      return;
    }
    await seller.logIntegrationError(
      integration.providerName,
      'UNSUPPORTED_EVENT',
      `Unsupported webhook event: ${event}`
    );
    logger.warn('Unsupported webhook event', { event, type: integration.type });
    return;
  }

  if (!handler.types.includes(integration.type)) {
    await seller.logIntegrationError(
      integration.providerName,
      'INVALID_EVENT_TYPE',
      `Event ${event} not supported for integration type ${integration.type}`
    );
    logger.warn('Event not supported for this integration type', {
      event,
      type: integration.type,
      supportedTypes: handler.types,
    });
    return;
  }

  try {
    await handler.handler(integration, sellerIntegration, seller, payload, integrationService);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await seller.logIntegrationError(integration.providerName, 'WEBHOOK_PROCESSING_ERROR', errorMessage);
    logger.error('Error processing webhook event', { event, error: errorMessage });
  }

  if (payload.error) {
    await seller.logIntegrationError(integration.providerName, payload.errorCode || 'UNKNOWN', payload.error);
  }
}