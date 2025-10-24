import { createProduct, getProductById, getSellerProducts, updateProduct } from "@/lib/actions/product.actions";
import { getSellerByUserId } from "@/lib/actions/seller.actions";
import { getDynamicIntegrations, DynamicIntegrationService } from "@/lib/services/integrations";
import { deleteFromStorage, uploadToStorage } from "@/lib/utils/cloudinary";
import { ImportExportService } from "@/lib/services/marketplace/import-export";
import { ImportOptions } from "@/lib/types/marketplace";
import Integration from "@/lib/db/models/integration.model";
import SellerIntegration from "@/lib/db/models/seller-integration.model";
import Supplier from "@/lib/db/models/supplier.model";
import { Order } from "@/lib/db/models/order.model";
import AdCampaign from "@/lib/db/models/ad-campaign.model";
import SubscriptionPlan from "@/lib/db/models/subscription-plan.model";
import Seller from "@/lib/db/models/seller.model";
import { connectToDatabase } from '@/lib/db';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import { sendNotification } from '@/lib/utils/notification';
import { encrypt } from '@/lib/utils/encryption';
import { isValidIBAN } from '@/lib/utils/iban';
import { Session } from 'next-auth';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Stripe from 'stripe';
import { z } from 'zod';
import Setting from '@/lib/db/models/setting.model';
import User from '@/lib/db/models/user.model';
import Setting from "@/lib/db/models/setting.model";





const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
});
const urlSchema = z.string().url().optional();
const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const ROUTING_REGEX = /^\d{9}$/;

async function logToApi(type: 'info' | 'error', message: string, meta: any, error?: string) {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        message,
        error,
        meta,
      }),
    });
  } catch (err) {
    console.error('Failed to send log to /api/log:', err);
  }
}

export const resolvers = {
  Query: {
    settings: async (_: any, __: any, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const settings = await Setting.findOne().lean();
        return settings || {};
      } catch (error) {
        throw new Error('Failed to fetch settings');
      }
    },
    seller: async (_: any, { sellerId }: { sellerId: string }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const seller = await Seller.findById(sellerId)
          .populate('subscription.planId')
          .lean();
        if (!seller) throw new Error('Seller not found');
        return seller;
      } catch (error) {
        throw new Error('Failed to fetch seller');
      }
    },
    sellers: async (_: any, { page = 1, limit = 10, search = '' }: { page: number, limit: number, search: string }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const skip = (page - 1) * limit;
        const query: any = { role: 'Seller' };
        
        if (search) {
          query.$or = [
            { businessName: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ];
        }

        const [sellers, total] = await Promise.all([
          Seller.find(query)
            .populate('subscription.planId')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 })
            .lean(),
          Seller.countDocuments(query)
        ]);

        const pages = Math.ceil(total / limit);

        return {
          sellers,
          pagination: { total, pages, current: page, pageSize: limit }
        };
      } catch (error) {
        throw new Error('Failed to fetch sellers');
      }
    },
    sellerMetrics: async (_: any, { sellerId }: { sellerId: string }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const metrics = {
          totalSales: 0,
          totalOrders: 0,
          revenue: { monthly: 0, yearly: 0 },
          analytics: { visitorsCount: 0, pageViews: 0 }
        };
        return metrics;
      } catch (error) {
        throw new Error('Failed to fetch metrics');
      }
    },
    aiAssistantStatus: async (_: any, { sellerId }: { sellerId: string }, { session }: { session: Session }) => {
      const requestId = uuidv4();
      try {
        if (!session?.user?.id || session.user.id !== sellerId) {
          await logToApi('error', 'Unauthorized access to AI assistant status', { requestId, sellerId });
          throw new Error('Unauthorized');
        }

        await connectToDatabase();
        const seller = await Seller.findById(sellerId).select('aiAssistant');
        const settings = await Setting.findOne().select('aiAssistant');
        if (!seller || !settings) {
          await logToApi('error', 'Seller or settings not found', { requestId, sellerId });
          throw new Error('Seller or settings not found');
        }

        const now = new Date();
        const isSubscribed = seller.aiAssistant.status === 'premium' && seller.aiAssistant.subscriptionEnd > now;

        return {
          uses: seller.aiAssistant.uses,
          limit: settings.aiAssistant.freeLimit,
          status: seller.aiAssistant.status,
          isSubscribed,
          enabled: settings.aiAssistant.enabled,
          subscriptionEnd: seller.aiAssistant.subscriptionEnd?.toISOString(),
        };
      } catch (error) {
        await logToApi('error', 'Failed to fetch AI assistant status', { requestId, sellerId }, String(error));
        throw new Error('Failed to fetch AI assistant status');
      }
    },
    sellerConfigurations: async (_: any, { sellerId }: { sellerId: string }) => {
      return {
        categories: ['electronics', 'fashion', 'home'],
        productStatuses: ['active', 'draft', 'outOfStock', 'pending'],
        dynamicSources: ['file', 'dropshipping'],
        layouts: ['grid', 'list', 'carousel'],
      };
    },
    integrations: async (_: any, { sellerId, sandboxMode }: { sellerId: string; sandboxMode: boolean }) => {
      const response = await getDynamicIntegrations(sellerId, sandboxMode);
      return response.data;
    },
    suppliers: async (_: any, { sellerId }: { sellerId: string }) => {
      try {
        const suppliers = await Supplier.find({ sellerId, isActive: true });
        return suppliers.map(supplier => ({
          id: supplier._id,
          name: supplier.name,
          address: supplier.address,
          contact: supplier.contact,
          agreements: supplier.agreements,
          type: supplier.type,
          status: supplier.status,
          estimatedDeliveryTime: supplier.estimatedDeliveryTime,
        }));
      } catch (error) {
        await logToApi('error', 'Failed to fetch suppliers', { sellerId }, String(error));
        throw new Error('Failed to fetch suppliers');
      }
    },
    orders: async (_: any, { sellerId }: { sellerId: string }) => {
      try {
        const orders = await Order.find({ sellerId });
        return orders.map(order => ({
          id: order._id,
          productId: order.productId,
          status: order.status,
          trackingNumber: order.trackingNumber,
          trackingUrl: order.trackingUrl,
          supplierId: order.supplierId,
          createdAt: order.createdAt.toISOString(),
        }));
      } catch (error) {
        await logToApi('error', 'Failed to fetch orders', { sellerId }, String(error));
        throw new Error('Failed to fetch orders');
      }
    },
    campaigns: async (_: any, { sellerId, sandbox, status, search, page, limit }: { sellerId: string; sandbox: boolean; status?: string; search?: string; page: number; limit: number }) => {
      try {
        let query: any = { sellerId, sandbox };
        if (status && status !== 'all') query.status = status;
        if (search) query.name = { $regex: search, $options: 'i' };
        const campaigns = await AdCampaign.find(query)
          .populate('products')
          .skip((page - 1) * limit)
          .limit(limit);
        const total = await AdCampaign.countDocuments(query);
        return {
          data: campaigns.map(campaign => ({
            _id: campaign._id,
            providerName: campaign.providerName,
            name: campaign.name,
            status: campaign.status,
            budget: campaign.budget,
            schedule: campaign.schedule,
            metrics: campaign.metrics,
            targeting: campaign.targeting,
            creatives: campaign.creatives,
            products: campaign.products.map((product: any) => ({
              _id: product._id,
              name: product.name,
              currency: product.pricing.currency,
              availability: product.availability,
            })),
          })),
          totalPages: Math.ceil(total / limit),
        };
      } catch (error) {
        await logToApi('error', 'Failed to fetch campaigns', { sellerId, sandbox, status, search, page, limit }, String(error));
        throw new Error('Failed to fetch campaigns');
      }
    },
    products: async (_: any, { sellerId, excludeProductId }: { sellerId: string; excludeProductId?: string }) => {
      const response = await getSellerProducts({ sellerId, excludeProductId });
      return response.data;
    },
    product: async (_: any, { id }: { id: string }) => {
      const result = await getProductById(id);
      return result.data;
    },
    campaign: async (_: any, { id }: { id: string }) => {
      try {
        const campaign = await AdCampaign.findById(id).populate('products');
        if (!campaign) {
          await logToApi('error', 'Campaign not found', { id });
          throw new Error('Campaign not found');
        }
        return {
          _id: campaign._id,
          providerName: campaign.providerName,
          name: campaign.name,
          status: campaign.status,
          budget: campaign.budget,
          schedule: campaign.schedule,
          metrics: campaign.metrics,
          targeting: campaign.targeting,
          creatives: campaign.creatives,
          integrationId: campaign.integrationId,
          products: campaign.products.map((product: any) => ({
            _id: product._id,
            name: product.name,
            currency: product.pricing.currency,
            availability: product.availability,
          })),
        };
      } catch (error) {
        await logToApi('error', 'Failed to fetch campaign', { id }, String(error));
        throw new Error('Failed to fetch campaign');
      }
    },
    getBankInfo: async (_: any, { sellerId }: { sellerId: string }, { session }: { session: Session }) => {
      const requestId = uuidv4();
      try {
        if (!session?.user?.id || session.user.id !== sellerId) {
          await logToApi('error', 'Unauthorized access to bank info', { requestId, sellerId });
          throw new Error('Unauthorized');
        }

        await connectToDatabase();
        const seller = await Seller.findOne({ userId: sellerId }).select('bankInfo');
        if (!seller) {
          await logToApi('error', 'Seller not found', { requestId, sellerId });
          throw new Error('Seller not found');
        }

        return {
          accountName: seller.bankInfo?.accountName || '',
          accountNumber: '',
          bankName: seller.bankInfo?.bankName || '',
          swiftCode: '',
          routingNumber: seller.bankInfo?.routingNumber || '',
          bankDocumentUrl: seller.bankInfo?.bankDocumentUrl || '',
          isVerified: seller.bankInfo?.verified || false,
        };
      } catch (error) {
        await logToApi('error', 'Failed to fetch bank info', { requestId, sellerId }, String(error));
        throw new Error('Failed to fetch bank info');
      }
    },
    getBankVerificationStatus: async (_: any, { sellerId }: { sellerId: string }, { session }: { session: Session }) => {
      const requestId = uuidv4();
      try {
        if (!session?.user?.id || session.user.id !== sellerId) {
          await logToApi('error', 'Unauthorized access to bank verification status', { requestId, sellerId });
          throw new Error('Unauthorized');
        }

        await connectToDatabase();
        const seller = await Seller.findOne({ userId: sellerId }).select('bankInfo');
        if (!seller) {
          await logToApi('error', 'Seller not found', { requestId, sellerId });
          throw new Error('Seller not found');
        }

        return seller.bankInfo?.verified || false;
      } catch (error) {
        await logToApi('error', 'Failed to fetch bank verification status', { requestId, sellerId }, String(error));
        throw new Error('Failed to fetch bank verification status');
      }
    },
    subscriptionPlans: async () => {
      try {
        await connectToDatabase();
        const plans = await SubscriptionPlan.find({ isActive: true }).lean();
        return plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          pointsCost: plan.pointsCost,
          currency: plan.currency,
          description: plan.description,
          features: plan.features,
          isTrial: plan.isTrial,
          trialDuration: plan.trialDuration,
          isActive: plan.isActive,
        }));
      } catch (error) {
        await logToApi('error', 'Failed to fetch subscription plans', {}, String(error));
        throw new Error('Failed to fetch subscription plans');
      }
    },
    sellerSubscription: async (_: any, { userId }: { userId: string }, { session }: { session: Session }) => {
      try {
        if (!session?.user?.id || session.user.id !== userId) {
          await logToApi('error', 'Unauthorized access to seller subscription', { userId });
          throw new Error('Unauthorized');
        }
        await connectToDatabase();
        const seller = await Seller.findOne({ userId }).lean();
        if (!seller) {
          await logToApi('error', 'Seller not found', { userId });
          throw new Error('Seller not found');
        }
        return {
          planId: seller.subscription.planId,
          status: seller.subscription.status,
          startDate: seller.subscription.startDate?.toISOString(),
          endDate: seller.subscription.endDate?.toISOString(),
          pointsBalance: seller.pointsBalance,
        };
      } catch (error) {
        await logToApi('error', 'Failed to fetch seller subscription', { userId }, String(error));
        throw new Error('Failed to fetch seller subscription');
      }
    },
    paymentMethods: async (_: any, { userId }: { userId: string }, { session }: { session: Session }) => {
      try {
        if (!session?.user?.id || session.user.id !== userId) {
          await logToApi('error', 'Unauthorized access to payment methods', { userId });
          throw new Error('Unauthorized');
        }
        await connectToDatabase();
        const seller = await Seller.findOne({ userId }).lean();
        if (!seller) {
          await logToApi('error', 'Seller not found', { userId });
          throw new Error('Seller not found');
        }
        return seller.paymentGateways
          .filter((gateway: any) => gateway.isActive)
          .map((gateway: any) => ({
            id: gateway._id || gateway.providerName,
            providerName: gateway.providerName,
          }));
      } catch (error) {
        await logToApi('error', 'Failed to fetch payment methods', { userId }, String(error));
        throw new Error('Failed to fetch payment methods');
      }
    },
  },
  Mutation: {
    createSubscriptionPlan: async (_: any, { input }: { input: any }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const sessionDb = await mongoose.startSession();
        sessionDb.startTransaction();
        try {
          const existingPlan = await SubscriptionPlan.findOne({ id: input.id || uuidv4() }).session(sessionDb);
          if (existingPlan) {
            throw new Error('Plan ID already exists');
          }
          const plan = await SubscriptionPlan.create({
            ...input,
            id: input.id || uuidv4(),
            createdBy: session.user.id,
            updatedBy: session.user.id,
          });
          await sessionDb.commitTransaction();
          return {
            success: true,
            message: 'Plan created successfully',
            data: plan,
          };
        } catch (error) {
          await sessionDb.abortTransaction();
          throw error;
        } finally {
          sessionDb.endSession();
        }
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to create plan');
      }
    },
    updateSeller: async (_: any, { sellerId, input }: { sellerId: string, input: any }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const sessionDb = await mongoose.startSession();
        sessionDb.startTransaction();
        
        try {
          const seller = await Seller.findByIdAndUpdate(
            sellerId,
            { ...input, updatedBy: session.user.id },
            { new: true, session: sessionDb }
          ).lean();

          if (!seller) {
            throw new Error('Seller not found');
          }

          await sessionDb.commitTransaction();
          return {
            success: true,
            message: 'Seller updated successfully',
            data: seller
          };
        } catch (error) {
          await sessionDb.abortTransaction();
          throw error;
        } finally {
          sessionDb.endSession();
        }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to update seller',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
    suspendSeller: async (_: any, { input }: { input: { sellerId: string, reason: string } }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const sessionDb = await mongoose.startSession();
        sessionDb.startTransaction();
        
        try {
          const seller = await Seller.findByIdAndUpdate(
            input.sellerId,
            { 
              status: 'suspended',
              suspended: true,
              suspendReason: input.reason,
              updatedBy: session.user.id 
            },
            { new: true, session: sessionDb }
          ).lean();

          if (!seller) {
            throw new Error('Seller not found');
          }

          await sessionDb.commitTransaction();
          return {
            success: true,
            message: 'Seller suspended successfully',
            data: seller
          };
        } catch (error) {
          await sessionDb.abortTransaction();
          throw error;
        } finally {
          sessionDb.endSession();
        }
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to suspend seller',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
    deleteSeller: async (_: any, { input }: { input: { sellerId: string } }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        await Seller.findByIdAndDelete(input.sellerId);
        return {
          success: true,
          message: 'Seller deleted successfully'
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to delete seller',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
    unsuspendSeller: async (_: any, { sellerId }: { sellerId: string }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const seller = await Seller.findByIdAndUpdate(
          sellerId,
          { 
            status: 'active',
            suspended: false,
            suspendReason: '',
            updatedBy: session.user.id 
          },
          { new: true }
        ).lean();

        if (!seller) {
          throw new Error('Seller not found');
        }

        return {
          success: true,
          message: 'Seller unsuspended successfully',
          data: seller
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to unsuspend seller',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    },
    updateSubscriptionPlan: async (_: any, { input }: { input: any }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const sessionDb = await mongoose.startSession();
        sessionDb.startTransaction();
        try {
          const plan = await SubscriptionPlan.findOne({ id: input.id }).session(sessionDb);
          if (!plan) {
            throw new Error('Plan not found');
          }
          await SubscriptionPlan.updateOne(
            { id: input.id },
            { ...input, updatedBy: session.user.id }
          );
          await sessionDb.commitTransaction();
          return {
            success: true,
            message: 'Plan updated successfully',
            data: { ...input },
          };
        } catch (error) {
          await sessionDb.abortTransaction();
          throw error;
        } finally {
          sessionDb.endSession();
        }
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to update plan');
      }
    },
    deleteSubscriptionPlan: async (_: any, { id }: { id: string }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const sessionDb = await mongoose.startSession();
        sessionDb.startTransaction();
        try {
          const plan = await SubscriptionPlan.findOne({ id }).session(sessionDb);
          if (!plan) {
            throw new Error('Plan not found');
          }
          await SubscriptionPlan.updateOne({ id }, { isActive: false });
          await sessionDb.commitTransaction();
          return {
            success: true,
            message: 'Plan deleted successfully',
          };
        } catch (error) {
          await sessionDb.abortTransaction();
          throw error;
        } finally {
          sessionDb.endSession();
        }
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to delete plan');
      }
    },
    updateSettings: async (_: any, { input }: { input: any }, { session }: { session: any }) => {
      if (!session?.user?.id || session.user.role !== 'Admin') {
        throw new Error('Unauthorized');
      }
      try {
        await connectToDatabase();
        const updatedSettings = await Setting.findOneAndUpdate({}, input, {
          upsert: true,
          new: true,
          lean: true,
        });
        return {
          success: true,
          message: 'Settings updated successfully',
          data: updatedSettings,
        };
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to update settings');
      }
    },
    createProduct: async (_: any, { input }: { input: any }) => {
      const requestId = uuidv4();
      const seller = await getSellerByUserId(input.sellerId);
      if (!seller.success || !seller.data) {
        await logToApi('error', 'Seller not found', { requestId, sellerId: input.sellerId });
        throw new Error('Seller not found');
      }

      const commissionRate = seller.data.wallet?.commissionRate || 0.1;
      const commission = input.pricing.basePrice * commissionRate;
      const productData = {
        ...input,
        tags: ['new-arrival', seller.data.subscription.plan === 'VIP' ? 'premium' : 'standard'],
        availability: input.countInStock > 0 ? 'in_stock' : 'out_of_stock',
        pricing: {
          ...input.pricing,
          commission,
        },
      };

      const result = await createProduct(productData);
      await logToApi('info', 'Product created successfully', {
        requestId,
        sellerId: input.sellerId,
        productId: result.data?._id,
      });
      return result.data;
    },
    updateProduct: async (_: any, { id, input }: { id: string; input: any }) => {
      const requestId = uuidv4();
      const productData = {
        _id: id,
        ...input,
        availability: input.countInStock > 0 ? 'in_stock' : 'out_of_stock',
      };
      const result = await updateProduct(productData);
      await logToApi('info', 'Product updated successfully', {
        requestId,
        productId: id,
        sellerId: input.sellerId,
      });
      return result.data;
    },
    uploadImage: async (_: any, { input }: { input: { file: any; folder: string } }) => {
      const requestId = uuidv4();
      const { file, folder } = input;
      try {
        const { secureUrl, publicId } = await uploadToStorage(file, `${folder}/${Date.now()}`);
        await logToApi('info', 'Image uploaded successfully', { requestId, publicId });
        return { url: secureUrl, publicId };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Image upload failed';
        await logToApi('error', 'Failed to upload image', { requestId, publicId }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    deleteImage: async (_: any, { publicId }: { publicId: string }) => {
      const requestId = uuidv4();
      try {
        await deleteFromStorage(publicId);
        await logToApi('info', 'Image deleted successfully', { requestId, publicId });
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Image deletion failed';
        await logToApi('error', 'Failed to delete image', { requestId, publicId }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    updateOrderStatus: async (_: any, { orderId, status }: { orderId: string; status: string }) => {
      const requestId = uuidv4();
      try {
        const order = await Order.findByIdAndUpdate(
          orderId,
          { status, updatedAt: new Date() },
          { new: true }
        );
        if (!order) {
          await logToApi('error', 'Order not found', { requestId, orderId });
          throw new Error('Order not found');
        }
        await logToApi('info', 'Order status updated', { requestId, orderId, status });
        return {
          id: order._id,
          status: order.status,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update order status';
        await logToApi('error', 'Failed to update order status', { requestId, orderId }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    importDropshippingProduct: async (
      _: any,
      { providerId, externalProductId }: { providerId: string; externalProductId: string },
      { session }: { session: Session }
    ) => {
      const requestId = uuidv4();
      if (!session?.user?.id) {
        await logToApi('error', 'Unauthorized access', { requestId, providerId, externalProductId });
        throw new Error('Unauthorized');
      }

      try {
        const integration = await Integration.findOne({ _id: providerId, type: 'dropshipping', isActive: true });
        if (!integration) {
          await logToApi('error', 'Integration not found', { requestId, providerId, sellerId: session.user.id });
          throw new Error('Integration not found');
        }

        const sellerIntegration = await SellerIntegration.findOne({
          sellerId: session.user.id,
          integrationId: providerId,
          isActive: true,
          status: 'connected',
        });
        if (!sellerIntegration) {
          await logToApi('error', 'Integration not connected', { requestId, providerId, sellerId: session.user.id });
          throw new Error('Integration not connected');
        }

        const dynamicIntegrationService = new DynamicIntegrationService(
          {
            _id: integration._id.toString(),
            type: integration.type,
            status: sellerIntegration.status,
            providerName: integration.providerName,
            settings: integration.settings,
            logoUrl: integration.logoUrl,
            webhook: sellerIntegration.webhook,
          },
          sellerIntegration
        );

        const productData = await dynamicIntegrationService.importProduct(externalProductId, session.user.id);

        await logToApi('info', 'Product imported via DynamicIntegrationService', {
          requestId,
          providerId,
          sellerId: session.user.id,
          externalProductId,
          productName: productData.name,
        });

        return {
          name: productData.name,
          description: productData.description,
          price: productData.price,
          images: productData.images,
          sku: productData.sku,
          currency: productData.currency,
          region: productData.region,
          availability: productData.availability,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logToApi('error', 'Failed to import product', {
          requestId,
          providerId,
          sellerId: session.user.id,
          externalProductId,
          error: errorMessage,
        }, errorMessage);

        try {
          const importExportService = new ImportExportService();
          const options: ImportOptions = {
            source: 'api',
            productId: externalProductId,
            region: 'global',
          };
          const result = await importExportService.importProducts(providerId, session.user.id, options);
          if (!result.success || !result.products || result.products.length === 0) {
            await logToApi('error', 'Failed to import product via fallback', {
              requestId,
              providerId,
              sellerId: session.user.id,
              externalProductId,
            });
            throw new Error('Failed to import product via fallback');
          }
          const product = result.products[0];
          await logToApi('info', 'Product imported via ImportExportService fallback', {
            requestId,
            providerId,
            sellerId: session.user.id,
            externalProductId,
            productName: product.title,
          });

          return {
            name: product.title,
            description: product.description,
            price: product.price,
            images: product.images.map(img => img.url),
            sku: product.sku,
            currency: product.currency,
            region: product.region,
            availability: product.availability,
          };
        } catch (fallbackError) {
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
          await logToApi('error', 'Fallback import failed', {
            requestId,
            providerId,
            sellerId: session.user.id,
            externalProductId,
            error: fallbackErrorMessage,
          }, fallbackErrorMessage);
          throw new Error(fallbackErrorMessage);
        }
      }
    },
    createCampaign: async (_: any, { input }: { input: any }) => {
      const requestId = uuidv4();
      try {
        const seller = await getSellerByUserId(input.sellerId);
        if (!seller.success || !seller.data) {
          await logToApi('error', 'Seller not found', { requestId, sellerId: input.sellerId });
          throw new Error('Seller not found');
        }

        const integration = await Integration.findById(input.integrationId);
        if (!integration) {
          await logToApi('error', 'Integration not found', { requestId, integrationId: input.integrationId });
          throw new Error('Integration not found');
        }

        const campaign = await AdCampaign.create({
          ...input,
          sellerId: input.sellerId,
          status: 'draft',
        });

        await logToApi('info', 'Campaign created successfully', {
          requestId,
          sellerId: input.sellerId,
          campaignId: campaign._id,
        });

        return {
          _id: campaign._id,
          providerName: integration.providerName,
          name: campaign.name,
          status: campaign.status,
          budget: campaign.budget,
          schedule: campaign.schedule,
          metrics: campaign.metrics,
          targeting: campaign.targeting,
          creatives: campaign.creatives,
          products: campaign.products,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create campaign';
        await logToApi('error', 'Failed to create campaign', { requestId, input }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    updateCampaign: async (_: any, { id, input }: { id: string; input: any }) => {
      const requestId = uuidv4();
      try {
        const campaign = await AdCampaign.findByIdAndUpdate(
          id,
          { ...input, updatedAt: new Date() },
          { new: true }
        ).populate('products');
        if (!campaign) {
          await logToApi('error', 'Campaign not found', { requestId, id });
          throw new Error('Campaign not found');
        }

        const integration = await Integration.findById(campaign.integrationId);
        if (!integration) {
          await logToApi('error', 'Integration not found', { requestId, integrationId: campaign.integrationId });
          throw new Error('Integration not found');
        }

        await logToApi('info', 'Campaign updated successfully', {
          requestId,
          campaignId: id,
          sellerId: input.sellerId,
        });

        return {
          _id: campaign._id,
          providerName: integration.providerName,
          name: campaign.name,
          status: campaign.status,
          budget: campaign.budget,
          schedule: campaign.schedule,
          metrics: campaign.metrics,
          targeting: campaign.targeting,
          creatives: campaign.creatives,
          products: campaign.products.map((product: any) => ({
            _id: product._id,
            name: product.name,
            currency: product.pricing.currency,
            availability: product.availability,
          })),
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update campaign';
        await logToApi('error', 'Failed to update campaign', { requestId, id }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    syncCampaignMetrics: async (_: any, { campaignId, sandbox }: { campaignId: string; sandbox: boolean }) => {
      const requestId = uuidv4();
      try {
        const campaign = await AdCampaign.findById(campaignId);
        if (!campaign) {
          await logToApi('error', 'Campaign not found', { requestId, campaignId });
          throw new Error('Campaign not found');
        }

        const integration = await Integration.findById(campaign.integrationId);
        const sellerIntegration = await SellerIntegration.findOne({
          sellerId: campaign.sellerId,
          integrationId: campaign.integrationId,
          isActive: true,
          sandbox,
        });

        if (!integration || !sellerIntegration) {
          await logToApi('error', 'Integration not found or not connected', { requestId, campaignId });
          throw new Error('Integration not found or not connected');
        }

        const service = new DynamicIntegrationService(
          {
            _id: integration._id.toString(),
            type: integration.type,
            status: sellerIntegration.status,
            providerName: integration.providerName,
            settings: integration.settings,
            logoUrl: integration.logoUrl,
            webhook: sellerIntegration.webhook,
          },
          sellerIntegration
        );

        const metricsResponse = await service.callApi({
          endpoint: integration.settings.endpoints?.get('syncMetrics') || `/campaigns/${campaign._id}/metrics`,
          method: 'GET',
        }) as {
          impressions?: number;
          clicks?: number;
          conversions?: number;
          spend?: number;
        };

        campaign.metrics = {
          impressions: metricsResponse.impressions || 0,
          clicks: metricsResponse.clicks || 0,
          conversions: metricsResponse.conversions || 0,
          spend: metricsResponse.spend || 0,
        };
        await campaign.save();

        await logToApi('info', 'Campaign metrics synced', { requestId, campaignId });

        return {
          metrics: campaign.metrics,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to sync campaign metrics';
        await logToApi('error', 'Failed to sync campaign metrics', { requestId, campaignId }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    deleteCampaign: async (_: any, { campaignId, sandbox }: { campaignId: string; sandbox: boolean }) => {
      const requestId = uuidv4();
      try {
        const campaign = await AdCampaign.findByIdAndDelete(campaignId);
        if (!campaign) {
          await logToApi('error', 'Campaign not found', { requestId, campaignId });
          throw new Error('Campaign not found');
        }
        await logToApi('info', 'Campaign deleted successfully', { requestId, campaignId });
        return true;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete campaign';
        await logToApi('error', 'Failed to delete campaign', { requestId, campaignId }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    updateBankInfo: async (_: any, { input }: { input: any }, { session }: { session: Session }) => {
      const requestId = uuidv4();
      const sessionMongo = await mongoose.startSession();
      try {
        if (!session?.user?.id) {
          await logToApi('error', 'Unauthorized access', { requestId });
          throw new Error('Unauthorized');
        }

        sessionMongo.startTransaction();
        await connectToDatabase();

        const bankInfoSchema = {
          accountName: input.accountName,
          accountNumber: input.accountNumber,
          bankName: input.bankName,
          swiftCode: input.swiftCode,
          routingNumber: input.routingNumber,
          bankDocumentUrl: input.bankDocumentUrl,
        };

        if (!isValidIBAN(bankInfoSchema.accountNumber)) {
          await logToApi('error', 'Invalid IBAN', { requestId, accountNumber: bankInfoSchema.accountNumber });
          throw new Error('Invalid IBAN');
        }

        if (!SWIFT_REGEX.test(bankInfoSchema.swiftCode)) {
          await logToApi('error', 'Invalid SWIFT code', { requestId, swiftCode: bankInfoSchema.swiftCode });
          throw new Error('Invalid SWIFT code');
        }

        if (bankInfoSchema.routingNumber && !ROUTING_REGEX.test(bankInfoSchema.routingNumber)) {
          await logToApi('error', 'Invalid routing number', { requestId, routingNumber: bankInfoSchema.routingNumber });
          throw new Error('Invalid routing number');
        }

        if (bankInfoSchema.bankDocumentUrl) {
          try {
            urlSchema.parse(bankInfoSchema.bankDocumentUrl);
          } catch (error) {
            await logToApi('error', 'Invalid bank document URL', { requestId, bankDocumentUrl: bankInfoSchema.bankDocumentUrl });
            throw new Error('Invalid bank document URL');
          }
        }

        const seller = await Seller.findOne({ userId: session.user.id }).session(sessionMongo);
        if (!seller) {
          await logToApi('error', 'Seller not found', { requestId });
          throw new Error('Seller not found');
        }

        const ibanResponse = await fetch(
          `https://api.iban.com/clients/api/swiftv2/bic/?format=json&api_key=${process.env.IBAN_API_KEY}&bic=${encodeURIComponent(input.swiftCode)}`
        );
        const ibanResult = await ibanResponse.json();
        if (!ibanResult.valid) {
          await logToApi('error', 'Invalid bank details', { requestId, swiftCode: input.swiftCode });
          throw new Error(ibanResult.error || 'Invalid bank details');
        }

        const mgpayGateway = seller.paymentGateways.find(g => g.providerName === 'mgpay' && g.isActive);
        const externalGateway = seller.paymentGateways.find(g => g.providerName !== 'mgpay' && !g.isInternal && g.isDefault);

        let verificationResult = { success: true, message: 'No verification needed for external gateways' };

        if (mgpayGateway) {
          verificationResult = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/verify-bank`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                iban: input.accountNumber,
                swift: input.swiftCode,
                routingNumber: input.routingNumber,
                countryCode: seller.address?.countryCode || 'US',
                bankDocumentUrl: input.bankDocumentUrl || 'https://placeholder.com/document.pdf',
              }),
            }
          ).then(res => res.json());
        } else if (externalGateway) {
          if (externalGateway.providerName === 'stripe') {
            try {
              await stripe.accounts.createExternalAccount(externalGateway.accountDetails.get('stripeAccountId') || seller.stripeAccountId, {
                external_account: {
                  object: 'bank_account',
                  country: seller.address?.countryCode || 'US',
                  currency: 'usd',
                  account_holder_name: input.accountName,
                  account_number: input.accountNumber,
                  routing_number: input.routingNumber || input.swiftCode,
                },
              });
              verificationResult = { success: true, message: 'Bank verified via Stripe' };
            } catch (error) {
              verificationResult = { success: false, message: (error as Error).message || 'Stripe verification failed' };
            }
          } else {
            const integration = await Integration.findOne({ providerName: externalGateway.providerName });
            if (!integration) {
              await logToApi('error', 'Integration not found', { requestId });
              throw new Error('Integration not found');
            }
            const endpoint = integration.apiEndpoints.get('verifyBank') || `${integration.settings.apiUrl}/verify-bank`;
            verificationResult = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: integration.settings.authType === 'Bearer' ? `Bearer ${integration.credentials.get('accessToken')}` : '',
              },
              body: JSON.stringify({
                accountName: input.accountName,
                accountNumber: input.accountNumber,
                bankName: input.bankName,
                swiftCode: input.swiftCode,
                routingNumber: input.routingNumber,
                bankDocumentUrl: input.bankDocumentUrl,
              }),
            }).then(res => res.json());
          }
        } else {
          await logToApi('error', 'No payment gateway configured', { requestId });
          throw new Error('No payment gateway configured');
        }

        if (!verificationResult.success) {
          await logToApi('error', 'Verification failed', { requestId, message: verificationResult.message });
          throw new Error(`Verification failed: ${verificationResult.message}`);
        }

        let stripeAccountId = seller.stripeAccountId;
        if (!stripeAccountId && externalGateway?.providerName === 'stripe') {
          const account = await stripe.accounts.create({
            type: 'custom',
            country: seller.address?.countryCode || 'US',
            email: seller.email,
            capabilities: {
              card_payments: { requested: true },
              transfers: { requested: true },
            },
            business_type: seller.businessType === 'individual' ? 'individual' : 'company',
            business_profile: {
              name: seller.businessName,
            },
          });
          stripeAccountId = account.id;
        }

        const encryptedAccountNumber = await encrypt(input.accountNumber);
        const encryptedSwiftCode = await encrypt(input.swiftCode);
        const encryptedRoutingNumber = input.routingNumber ? await encrypt(input.routingNumber) : undefined;

        seller.bankInfo = {
          accountName: input.accountName,
          accountNumber: encryptedAccountNumber,
          bankName: input.bankName,
          swiftCode: encryptedSwiftCode,
          routingNumber: encryptedRoutingNumber,
          bankDocumentUrl: input.bankDocumentUrl || '',
          verified: verificationResult.success,
        };
        seller.stripeAccountId = stripeAccountId;

        await seller.save({ session: sessionMongo });
        await sessionMongo.commitTransaction();

        await logToApi('info', 'Bank info updated successfully', { requestId, sellerId: session.user.id });

        return {
          accountName: input.accountName,
          accountNumber: '',
          bankName: input.bankName,
          swiftCode: '',
          routingNumber: input.routingNumber || '',
          bankDocumentUrl: input.bankDocumentUrl || '',
          isVerified: verificationResult.success,
        };
      } catch (error) {
        await sessionMongo.abortTransaction();
        await logToApi('error', 'Failed to update bank info', { requestId, sellerId: session.user.id }, String(error));
        throw new Error(error instanceof Error ? error.message : 'Failed to update bank info');
      } finally {
        sessionMongo.endSession();
      }
    },
    redeemSubscriptionPoints: async (
      _: any,
      { input }: { input: { planId: string; pointsToRedeem: number; paymentMethodId: string } },
      { session }: { session: Session }
    ) => {
      const requestId = uuidv4();
      try {
        if (!session?.user?.id) {
          await logToApi('error', 'Unauthorized access', { requestId });
          throw new Error('Unauthorized');
        }

        await connectToDatabase();
        const sessionDb = await mongoose.startSession();
        sessionDb.startTransaction();

        try {
          const seller = await Seller.findOne({ userId: session.user.id }).session(sessionDb);
          if (!seller) {
            throw new Error('Seller not found');
          }

          const plan = await SubscriptionPlan.findOne({ id: input.planId, isActive: true }).session(sessionDb);
          if (!plan) {
            throw new Error('Plan not found');
          }

          if (input.pointsToRedeem > seller.pointsBalance) {
            throw new Error('Insufficient points');
          }

          seller.pointsBalance -= input.pointsToRedeem;
          seller.pointsHistory.push({
            amount: input.pointsToRedeem,
            type: 'debit',
            reason: `Redeemed for ${plan.name} subscription`,
            createdAt: new Date(),
          });

          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + (plan.isTrial ? plan.trialDuration! : 1));

          seller.subscription = {
            plan: plan.name,
            planId: plan.id,
            price: plan.price,
            pointsCost: plan.pointsCost,
            status: 'active',
            startDate,
            endDate,
            lastPaymentDate: new Date(),
            paymentMethodId: input.paymentMethodId,
            pointsRedeemed: input.pointsToRedeem,
            features: plan.features,
            isTrial: plan.isTrial,
            trialDuration: plan.trialDuration,
          };

          await seller.save({ session: sessionDb });

          await sessionDb.commitTransaction();

          await sendNotification({
            userId: session.user.id,
            type: 'subscription_updated',
            title: 'Subscription Updated',
            message: `Your subscription to ${plan.name} has been updated using points.`,
            data: { planId: plan.id, sellerId: seller._id },
            channels: ['in_app', 'email'],
          });

          await logToApi('info', 'Subscription points redeemed', { requestId, userId: session.user.id, planId: input.planId });

          return {
            success: true,
            message: 'Subscription points redeemed successfully',
            data: {
              planId: seller.subscription.planId,
              status: seller.subscription.status,
              startDate: seller.subscription.startDate?.toISOString(),
              endDate: seller.subscription.endDate?.toISOString(),
              pointsBalance: seller.pointsBalance,
            },
          };
        } catch (error) {
          await sessionDb.abortTransaction();
          throw error;
        } finally {
          sessionDb.endSession();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to redeem points';
        await logToApi('error', 'Failed to redeem subscription points', { requestId, input }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    updateSubscription: async (
      _: any,
      { input }: { input: { planId: string; paymentMethodId: string; paymentDetails?: any; dropshippingIntegrations?: string[] } },
      { session }: { session: Session }
    ) => {
      const requestId = uuidv4();
      try {
        if (!session?.user?.id) {
          await logToApi('error', 'Unauthorized access', { requestId });
          throw new Error('Unauthorized');
        }

        await connectToDatabase();
        const sessionDb = await mongoose.startSession();
        sessionDb.startTransaction();

        try {
          const seller = await Seller.findOne({ userId: session.user.id }).session(sessionDb);
          if (!seller) {
            throw new Error('Seller not found');
          }

          const plan = await SubscriptionPlan.findOne({ id: input.planId, isActive: true }).session(sessionDb);
          if (!plan) {
            throw new Error('Plan not found');
          }

          let paymentIntegration = null;
          if (input.paymentMethodId && input.paymentMethodId !== 'points') {
            const integration = await Integration.findOne({ _id: input.paymentMethodId, type: 'payment' }).session(sessionDb);
            if (!integration) {
              throw new Error('Payment integration not found');
            }

            const sellerIntegration = await SellerIntegration.findOne({
              sellerId: seller._id,
              integrationId: integration._id,
              isActive: true,
              status: 'connected',
            }).session(sessionDb);
            if (!sellerIntegration) {
              throw new Error('Payment integration not connected');
            }

            if (integration.providerName === 'mgpay' && !seller.bankInfo?.verified) {
              throw new Error('Bank not verified for mgpay');
            }

            paymentIntegration = integration;
            const paymentService = new GenericIntegrationService(integration, sellerIntegration);
            const paymentResponse = await paymentService.callApi({
              endpoint: integration.settings.endpoints?.createPayment || '/payments',
              method: 'POST',
              body: {
                amount: plan.price,
                currency: plan.currency || 'USD',
                source: input.paymentDetails?.token,
                description: `Subscription payment for ${plan.name}`,
                metadata: { sellerId: seller._id, planId: plan.id },
              },
            });

            if (!paymentResponse.success) {
              throw new Error('Payment failed');
            }
          }

          let dropshippingFees = 0;
          if (input.dropshippingIntegrations?.length) {
            const dropshippingIntegrations = await Integration.find({
              _id: { $in: input.dropshippingIntegrations },
              type: 'dropshipping',
            }).session(sessionDb);
            dropshippingFees = dropshippingIntegrations.reduce((sum, int) => sum + (int.settings.fee || 0), 0);
          }

          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + (plan.isTrial ? plan.trialDuration! : 1));

          seller.subscription = {
            plan: plan.name,
            planId: plan.id,
            price: plan.price + dropshippingFees,
            pointsCost: plan.pointsCost,
            status: 'active',
            startDate,
            endDate,
            lastPaymentDate: new Date(),
            paymentMethodId: input.paymentMethodId,
            paymentDetails: input.paymentDetails,
            pointsRedeemed: input.paymentMethodId === 'points' ? plan.pointsCost : 0,
            features: plan.features,
            isTrial: plan.isTrial,
            trialDuration: plan.trialDuration,
            dropshippingIntegrations: input.dropshippingIntegrations || [],
          };

          await seller.save({ session: sessionDb });

          await sessionDb.commitTransaction();

          await sendNotification({
            userId: session.user.id,
            type: 'subscription_updated',
            title: 'Subscription Updated',
            message: `Your subscription to ${plan.name} has been updated.`,
            data: { planId: plan.id, sellerId: seller._id },
            channels: ['in_app', 'email'],
          });

          await logToApi('info', 'Subscription updated', { requestId, userId: session.user.id, planId: input.planId });

          return {
            success: true,
            message: 'Subscription updated successfully',
            data: {
              planId: seller.subscription.planId,
              status: seller.subscription.status,
              startDate: seller.subscription.startDate?.toISOString(),
              endDate: seller.subscription.endDate?.toISOString(),
              pointsBalance: seller.pointsBalance,
            },
          };
        } catch (error) {
          await sessionDb.abortTransaction();
          throw error;
        } finally {
          sessionDb.endSession();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update subscription';
        await logToApi('error', 'Failed to update subscription', { requestId, input }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    activateAIAssistantSubscription: async (_: any, { sellerId, paymentMethodId }: { sellerId: string, paymentMethodId: string }, { session }: { session: Session }) => {
      const requestId = uuidv4();
      try {
        if (!session?.user?.id || session.user.id !== sellerId) {
          await logToApi('error', 'Unauthorized access', { requestId, sellerId });
          throw new Error('Unauthorized');
        }

        await connectToDatabase();
        const sessionDb = await mongoose.startSession();
        sessionDb.startTransaction();

        try {
          const seller = await Seller.findById(sellerId).session(sessionDb);
          const settings = await Setting.findOne().session(sessionDb);
          if (!seller || !settings) {
            throw new Error('Seller or settings not found');
          }

          if (!settings.aiAssistant.enabled) {
            throw new Error('AI Assistant is disabled');
          }

          const paymentIntegration = await Integration.findOne({ _id: paymentMethodId, type: 'payment' }).session(sessionDb);
          if (!paymentIntegration) {
            throw new Error('Payment integration not found');
          }

          const sellerIntegration = await SellerIntegration.findOne({
            sellerId,
            integrationId: paymentMethodId,
            isActive: true,
            status: 'connected',
          }).session(sessionDb);
          if (!sellerIntegration) {
            throw new Error('Payment integration not connected');
          }

          let customerId = seller.stripeAccountId;
          if (!customerId) {
            const customer = await stripe.customers.create({ email: seller.email });
            customerId = customer.id;
            seller.stripeAccountId = customerId;
          }

          const product = await stripe.products.create({
            name: 'AI Assistant Premium Subscription',
            description: settings.aiAssistant.description,
            images: [settings.aiAssistant.image],
          });

          const price = await stripe.prices.create({
            product: product.id,
            unit_amount: Math.round(settings.aiAssistant.price * 100),
            currency: 'usd',
            recurring: { interval: 'month' },
          });

          const subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: price.id }],
            payment_behavior: 'default_incomplete',
            expand: ['latest_invoice.payment_intent'],
          });

          seller.aiAssistant = {
            uses: 0,
            limit: null,
            status: 'premium',
            subscriptionStart: new Date(),
            subscriptionEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
          };

          await seller.save({ session: sessionDb });
          await sessionDb.commitTransaction();

          await sendNotification({
            userId: session.user.id,
            type: 'subscription_updated',
            title: 'AI Assistant Subscription Activated',
            message: 'Your AI Assistant Premium subscription has been activated.',
            data: { sellerId, subscriptionId: subscription.id },
            channels: ['in_app', 'email'],
          });

          await logToApi('info', 'AI Assistant subscription activated', { requestId, sellerId });

          return {
            success: true,
            message: 'AI Assistant subscription activated successfully',
            subscriptionId: subscription.id,
          };
        } catch (error) {
          await sessionDb.abortTransaction();
          throw error;
        } finally {
          sessionDb.endSession();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to activate AI Assistant subscription';
        await logToApi('error', 'Failed to activate AI Assistant subscription', { requestId, sellerId }, errorMessage);
        throw new Error(errorMessage);
      }
    },
    resetAIAssistantUses: async (_: any, { sellerId }: { sellerId: string }, { session }: { session: Session }) => {
      const requestId = uuidv4();
      try {
        if (!session?.user?.id || session.user.id !== sellerId) {
          await logToApi('error', 'Unauthorized access', { requestId, sellerId });
          throw new Error('Unauthorized');
        }

        await connectToDatabase();
        const seller = await Seller.findByIdAndUpdate(
          sellerId,
          { $set: { 'aiAssistant.uses': 0 } },
          { new: true }
        );

        if (!seller) {
          throw new Error('Seller not found');
        }

        await logToApi('info', 'AI Assistant uses reset', { requestId, sellerId });

        return {
          success: true,
          message: 'AI Assistant uses reset successfully',
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to reset AI Assistant uses';
        await logToApi('error', 'Failed to reset AI Assistant uses', { requestId, sellerId }, errorMessage);
        throw new Error(errorMessage);
      }
    },
  },
};