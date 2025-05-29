'use server';

import { connectToDatabase } from '@/lib/db';
import Seller, { ISeller } from '@/lib/db/models/seller.model';
import User from '@/lib/db/models/user.model';
import Order from '@/lib/db/models/order.model';
import Product from '@/lib/db/models/product.model';
import mongoose from 'mongoose';
import { revalidatePath } from 'next/cache';
import { uploadToStorage as uploadToS3, deleteFromStorage as deleteFromS3 } from '@/lib/utils/s3';
import { sendNotification } from '@/lib/utils/notification';
import { DocumentVerification } from '@/lib/utils/verification';
import { cache } from 'react';
import { getSetting } from './setting.actions';
import { round2 } from '@/lib/utils';
import Stripe from 'stripe';
import { auth } from '@/auth';
import { getTranslations } from 'next-intl/server';
import paypal from '@paypal/checkout-server-sdk';
import { subscriptionPlans } from '@/lib/constants';
import { ApiKeyService } from '@/lib/api/services/api-key.service';
import { z } from 'zod';
import { decrypt, encrypt } from '../utils/encryption';
import { isValidIBAN } from 'iban';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;


// Initialize PayPal
const paypalClient = new paypal.core.PayPalHttpClient(
  new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID || '',
    process.env.PAYPAL_CLIENT_SECRET || ''
  )
);

class SellerError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = 'SellerError';
  }
}

// Define schemas and types (already defined in previous code, included for completeness)
const PERFORMANCE_MARKERS = {
  START: 'seller-metrics-start',
  END: 'seller-metrics-end',
};

export type SellerFormData = {
  businessName: string;
  email: string;
  phone: string;
  description?: string;
  businessType: 'individual' | 'company';
  vatRegistered: boolean;
  logo?: File;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  taxId: string;
  bankInfo: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode: string;
  };
  termsAccepted: boolean;
  customSiteUrl: string;
};

export type DocumentType = 'businessLicense' | 'taxDocument' | 'identityProof' | 'other';
export type SubscriptionPlan = 'Trial' | 'Basic' | 'Pro' | 'VIP';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending' | 'suspended';

export interface DocumentUpload {
  file: File;
  type: DocumentType;
  metadata?: Record<string, any>;
}

export interface SellerMetrics {
  revenue: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
    trend: 'up' | 'down' | 'stable';
    percentage: number;
  };
  orders: {
    pending: number;
    completed: number;
    cancelled: number;
    total: number;
    avgOrderValue: number;
  };
  products: {
    active: number;
    outOfStock: number;
    total: number;
    topSelling: Array<{
      id: string;
      name: string;
      sales: number;
    }>;
  };
  performance: {
    rating: number;
    responseTime: number;
    fulfillmentRate: number;
    returnRate: number;
    customerSatisfaction: number;
  };
  analytics: {
    visitorsCount: number;
    conversionRate: number;
    abandonedCartRate: number;
    repeatCustomerRate: number;
  };
  points: {
    balance: number;
    totalEarned: number;
    totalRedeemed: number;
    recentTransactions: Array<{
      amount: number;
      type: 'earn' | 'redeem';
      description: string;
      createdAt: Date;
    }>;
  };
}

export interface ProductFilters {
  search?: string;
  status?: 'active' | 'draft' | 'outOfStock';
  category?: string;
  sortBy?: 'createdAt' | 'price' | 'stock' | 'sales';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface OrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface SettingsFormData {
  businessName?: string;
  description?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  bankInfo?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode: string;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    orderUpdates: boolean;
    marketingEmails: boolean;
    pointsNotifications: boolean;
  };
  display: {
    showRating: boolean;
    showContactInfo: boolean;
    showMetrics: boolean;
    showPointsBalance: boolean;
  };
  security: {
    twoFactorAuth: boolean;
    loginNotifications: boolean;
  };
  customSite: {
    theme: string;
    primaryColor: string;
    bannerImage?: string;
    customSections?: any[];
  };
  customSiteUrl?: string;
}

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

async function generateCustomSiteUrl(businessName: string): Promise<string> {
  const baseUrl = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
  let customSiteUrl = baseUrl;
  let counter = 1;

  while (await Seller.exists({ customSiteUrl })) {
    customSiteUrl = `${baseUrl}-${counter}`;
    counter++;
  }

  return customSiteUrl;
}

// Helper functions (already defined, included for completeness)
export async function calculateRevenueHelper(sellerId: string, startDate: Date) {
  if (!isValidObjectId(sellerId)) {
    throw new SellerError('Invalid seller ID', 'INVALID_ID');
  }

  try {
    const orders = await Order.aggregate([
      {
        $match: {
          sellerId: new mongoose.Types.ObjectId(sellerId),
          status: 'completed',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          count: { $sum: 1 },
          average: { $avg: '$total' },
          previous: {
            $sum: {
              $cond: [{ $lt: ['$createdAt', startDate] }, '$total', 0],
            },
          },
        },
      },
    ]);

    return {
      total: orders[0]?.total || 0,
      count: orders[0]?.count || 0,
      average: orders[0]?.average || 0,
      previous: orders[0]?.previous || 0,
    };
  } catch (error) {
    console.error('Calculate revenue error:', error);
    throw new SellerError('Failed to calculate revenue', 'CALCULATION_ERROR');
  }
}

export async function getSellerEarnings(sellerId: string, startDate: Date, endDate: Date) {
  try {
    await connectToDatabase();

    const earnings = await Order.aggregate([
      {
        $match: {
          status: 'completed',
          'items.sellerId': sellerId,
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $project: {
          items: {
            $filter: {
              input: '$items',
              as: 'item',
              cond: { $eq: ['$$item.sellerId', sellerId] },
            },
          },
        },
      },
      {
        $unwind: '$items',
      },
      {
        $group: {
          _id: null,
          totalEarnings: {
            $sum: {
              $multiply: ['$items.quantity', '$items.price'],
            },
          },
        },
      },
    ]);

    return earnings[0]?.totalEarnings || 0;
  } catch (error) {
    console.error('Get seller earnings error:', error);
    throw new Error('Failed to get seller earnings');
  }
}

export async function calculateTrendHelper(current: number, average: number): Promise<'up' | 'down' | 'stable'> {
  try {
    const difference = current - average;
    const threshold = average * 0.05;

    if (difference > threshold) return 'up';
    if (difference < -threshold) return 'down';
    return 'stable';
  } catch (error) {
    console.error('Calculate trend error:', error);
    return 'stable';
  }
}

export async function calculateGrowthPercentageHelper(current: number, previous: number): Promise<number> {
  try {
    if (previous === 0) return current > 0 ? 100 : 0;
    return round2(((current - previous) / previous) * 100);
  } catch (error) {
    console.error('Calculate growth percentage error:', error);
    return 0;
  }
}

export async function calculateOrderStats(sellerId: string) {
  try {
    if (!isValidObjectId(sellerId)) {
      throw new SellerError('Invalid seller ID', 'INVALID_ID');
    }

    const stats = await Order.aggregate([
      {
        $match: {
          sellerId: new mongoose.Types.ObjectId(sellerId),
        },
      },
      {
        $group: {
          _id: null,
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
          total: { $sum: 1 },
          totalValue: { $sum: '$total' },
        },
      },
    ]);

    const result = stats[0] || {
      pending: 0,
      completed: 0,
      cancelled: 0,
      total: 0,
      totalValue: 0,
    };

    return {
      pending: result.pending,
      completed: result.completed,
      cancelled: result.cancelled,
      total: result.total,
      avgOrderValue: result.total > 0 ? round2(result.totalValue / result.total) : 0,
    };
  } catch (error) {
    console.error('Calculate order stats error:', error);
    throw new SellerError('Failed to calculate order stats', 'CALCULATION_ERROR');
  }
}

export async function calculateProductStats(sellerId: string) {
  try {
    if (!isValidObjectId(sellerId)) {
      throw new SellerError('Invalid seller ID', 'INVALID_ID');
    }

    const [basicStats, topSelling] = await Promise.all([
      Product.aggregate([
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
          },
        },
        {
          $group: {
            _id: null,
            active: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'active'] },
                      { $gt: ['$countInStock', 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            outOfStock: {
              $sum: { $cond: [{ $eq: ['$countInStock', 0] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
      ]),
      Product.aggregate([
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
            'metrics.sales': { $gt: 0 },
          },
        },
        {
          $sort: { 'metrics.sales': -1 },
        },
        {
          $limit: 5,
        },
        {
          $project: {
            id: '$_id',
            name: '$name',
            sales: '$metrics.sales',
            _id: 0,
          },
        },
      ]),
    ]);

    const stats = basicStats[0] || {
      active: 0,
      outOfStock: 0,
      total: 0,
    };

    return {
      active: stats.active,
      outOfStock: stats.outOfStock,
      total: stats.total,
      topSelling,
    };
  } catch (error) {
    console.error('Calculate product stats error:', error);
    throw new SellerError('Failed to calculate product stats', 'CALCULATION_ERROR');
  }
}

export async function calculatePerformanceStats(sellerId: string) {
  try {
    if (!isValidObjectId(sellerId)) {
      throw new SellerError('Invalid seller ID', 'INVALID_ID');
    }

    const [ratingStats, orderStats] = await Promise.all([
      Product.aggregate([
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
          },
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$metrics.rating' },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            sellerId: new mongoose.Types.ObjectId(sellerId),
            status: { $in: ['completed', 'returned'] },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            returnedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] },
            },
            totalResponseTime: { $avg: '$metrics.responseTime' },
            fulfillmentTime: { $avg: '$metrics.fulfillmentTime' },
          },
        },
      ]),
    ]);

    const rating = ratingStats[0]?.avgRating || 0;
    const orders = orderStats[0] || {
      totalOrders: 0,
      returnedOrders: 0,
      totalResponseTime: 0,
      fulfillmentTime: 0,
    };

    const returnRate =
      orders.totalOrders > 0
        ? round2((orders.returnedOrders / orders.totalOrders) * 100)
        : 0;

    const fulfillmentRate =
      orders.totalOrders > 0
        ? round2(((orders.totalOrders - orders.returnedOrders) / orders.totalOrders) * 100)
        : 0;

    return {
      rating: round2(rating),
      responseTime: round2(orders.totalResponseTime || 0),
      fulfillmentRate,
      returnRate,
      customerSatisfaction: round2(rating * 20),
    };
  } catch (error) {
    console.error('Calculate performance stats error:', error);
    throw new SellerError('Failed to calculate performance stats', 'CALCULATION_ERROR');
  }
}

export async function calculateAnalyticsStats(sellerId: string) {
  try {
    if (!isValidObjectId(sellerId)) {
      throw new SellerError('Invalid seller ID', 'INVALID_ID');
    }

    const stats = await Order.aggregate([
      {
        $match: {
          sellerId: new mongoose.Types.ObjectId(sellerId),
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          uniqueCustomers: { $addToSet: '$userId' },
          abandonedCarts: {
            $sum: { $cond: [{ $eq: ['$status', 'abandoned'] }, 1, 0] },
          },
          repeatCustomers: {
            $sum: {
              $cond: [{ $gt: [{ $size: { $ifNull: ['$previousOrders', []] } }, 0] }, 1, 0],
            },
          },
          totalVisitors: { $sum: { $ifNull: ['$metrics.pageViews', 0] } },
        },
      },
    ]);

    const data = stats[0] || {
      totalOrders: 0,
      uniqueCustomers: [],
      abandonedCarts: 0,
      repeatCustomers: 0,
      totalVisitors: 0,
    };

    const visitorsCount = data.totalVisitors;
    const conversionRate =
      visitorsCount > 0 ? round2((data.totalOrders / visitorsCount) * 100) : 0;
    const abandonedCartRate =
      data.totalOrders > 0
        ? round2((data.abandonedCarts / (data.totalOrders + data.abandonedCarts)) * 100)
        : 0;
    const uniqueCustomersCount = data.uniqueCustomers.length;
    const repeatCustomerRate =
      uniqueCustomersCount > 0
        ? round2((data.repeatCustomers / uniqueCustomersCount) * 100)
        : 0;

    return {
      visitorsCount,
      conversionRate,
      abandonedCartRate,
      repeatCustomerRate,
    };
  } catch (error) {
    console.error('Calculate analytics stats error:', error);
    throw new SellerError('Failed to calculate analytics stats', 'CALCULATION_ERROR');
  }
}

export async function calculatePointsStats(sellerId: string) {
  try {
    if (!isValidObjectId(sellerId)) {
      throw new SellerError('Invalid seller ID', 'INVALID_ID');
    }

    const seller = await Seller.findById(sellerId).select('pointsBalance pointsTransactions');
    if (!seller) {
      throw new SellerError('Seller not found', 'NOT_FOUND');
    }

    const transactions = seller.pointsTransactions.slice(0, 10);
    const totalEarned = seller.pointsTransactions.reduce((sum, tx) => {
      return tx.type === 'earn' ? sum + tx.amount : sum;
    }, 0);
    const totalRedeemed = seller.pointsTransactions.reduce((sum, tx) => {
      return tx.type === 'redeem' ? sum + tx.amount : sum;
    }, 0);

    return {
      balance: seller.pointsBalance,
      totalEarned,
      totalRedeemed,
      recentTransactions: transactions.map((tx) => ({
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        createdAt: tx.createdAt,
      })),
    };
  } catch (error) {
    console.error('Calculate points stats error:', error);
    throw new SellerError('Failed to calculate points stats', 'CALCULATION_ERROR');
  }
}

// Existing functions (already defined, included for completeness)
export async function getSellerByUserId(userId: string, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();

    if (!mongoose.isValidObjectId(userId)) {
      throw new SellerError(t('invalidSellerData'), 'INVALID_ID');
    }

    const seller = await Seller.findOne({ userId }); // بدون .lean()

    if (!seller) {
      console.log('No seller found for userId:', userId);
      throw new SellerError(t('sellerNotFound'), 'NOT_FOUND');
    }

    if (seller.bankInfo && !seller.bankInfo.verified) {
      console.warn(`Bank info for seller ${seller._id} needs verification`);
    }

    return {
      success: true,
      data: seller,
    };
  } catch (error) {
    console.error('Get seller error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('failedToGetSeller'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function getSellerById(sellerId: string, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();

    const seller = await Seller.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(sellerId) ? sellerId : null },
        { businessName: sellerId },
      ],
    })
      .select('-bankInfo.accountNumber')
      .lean();

    if (!seller) {
      throw new SellerError(t('sellerNotFound'), 'NOT_FOUND');
    }

    return {
      success: true,
      data: seller,
    };
  } catch (error) {
    console.error('Get seller by ID error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('failedToGetSeller'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function getSellerByBusinessName(businessName: string, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();

    const seller = await Seller.findOne({ businessName })
      .select('-bankInfo.accountNumber')
      .lean();

    if (!seller) {
      throw new SellerError(t('sellerNotFound'), 'NOT_FOUND');
    }

    return {
      success: true,
      data: seller,
    };
  } catch (error) {
    console.error('Get seller by business name error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('failedToGetSeller'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}


export async function createSellerApiKey(
  userId: string,
  name: string,
  permissions: string[],
  expiresAt?: Date,
  locale: string = 'en'
) {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      // تحقق من صحة الأذونات
      const validPermissions = [
        'products:read', 'products:write', 'orders:read', 'orders:write',
        'customers:read', 'customers:write', 'inventory:read', 'inventory:write',
        'analytics:read'
      ];
      const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        throw new SellerError(t('errors.invalidPermissions', { permissions: invalidPermissions.join(', ') }), 'INVALID_PERMISSIONS');
      }

      const planConfig = subscriptionPlans.find((p) => p.name === seller.subscription.plan);
      const maxKeys = planConfig?.features.maxApiKeys || 1;
      const keyCount = await ApiKey.countDocuments({ sellerId: seller._id });

      if (keyCount >= maxKeys) {
        throw new SellerError(t('errors.apiKeyLimitExceeded', { limit: maxKeys }), 'API_KEY_LIMIT');
      }

      const serverSession = await auth();
      const currentUser = serverSession?.user?.id || 'system';

      const apiKey = await ApiKeyService.createApiKey(
        {
          name,
          permissions,
          expiresAt,
          sellerId: seller._id,
        },
        { createdBy: currentUser, updatedBy: currentUser }
      );

      seller.apiKeys.push(apiKey._id);
      await seller.save({ session });

      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/settings/security', 'page');

      await sendNotification({
        userId,
        type: 'api_key_created',
        title: t('messages.apiKeyCreatedTitle'),
        message: t('messages.apiKeyCreatedMessage', { name }),
        data: { sellerId: seller._id, apiKeyId: apiKey._id },
      });

      return {
        success: true,
        data: apiKey,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Create API key error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.apiKeyCreationFailed'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}


export async function getSellerApiKeys(userId: string, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();

    if (!isValidObjectId(userId)) {
      throw new SellerError(t('invalidSellerData'), 'INVALID_ID');
    }

    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('sellerNotFound'), 'NOT_FOUND');
    }

    const apiKeys = await ApiKey.find({ sellerId: seller._id }).select(
      '_id name permissions isActive expiresAt lastUsed createdAt'
    );

    return {
      success: true,
      data: apiKeys,
    };
  } catch (error) {
    console.error('Get API keys error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('failedToGetApiKeys'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}


export async function createSeller(userId: string, data: SellerFormData, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new SellerError(t('errors.userNotFound'), 'USER_NOT_FOUND');
      }

      const existingSeller = await Seller.findOne({
        $or: [{ email: data.email }, { userId }, { customSiteUrl: data.customSiteUrl }],
      }).session(session);

      if (existingSeller) {
        console.log('Duplicate seller found:', existingSeller);
        throw new SellerError(t('messages.sellerExists'), 'DUPLICATE_SELLER');
      }

      if (!data.termsAccepted) {
        throw new SellerError(t('errors.termsNotAccepted'), 'TERMS_NOT_ACCEPTED');
      }

      const customSiteUrl = data.customSiteUrl || (await generateCustomSiteUrl(data.businessName));

      let logoUrl: string | undefined;
      if (data.logo && data.logo.size > 0) {
        logoUrl = await uploadToS3(data.logo, `sellers/${userId}/logo`, {
          contentType: data.logo.type,
          maxSize: 5 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        });
      }

      const trialEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const seller = await Seller.create(
        [
          {
            userId,
            businessName: data.businessName,
            email: data.email,
            phone: data.phone,
            description: data.description,
            businessType: data.businessType,
            vatRegistered: data.vatRegistered,
            logo: logoUrl,
            address: data.address,
            taxId: data.taxId,
            bankInfo: {
              accountName: '',
              accountNumber: '',
              bankName: '',
              swiftCode: '',
              verified: false,
            },
            subscription: {
              plan: 'Trial',
              startDate: new Date(),
              endDate: trialEndDate,
              status: 'active',
              features: {
                productsLimit: 50,
                commission: 7,
                prioritySupport: false,
                instantPayouts: false,
              },
            },
            verification: {
              status: 'pending',
              documents: new Map(),
              submittedAt: new Date(),
            },
            metrics: {
              rating: 0,
              totalSales: 0,
              totalRevenue: 0,
              productsCount: 0,
              ordersCount: 0,
              customersCount: 0,
              views: 0,
              followers: 0,
              products: {
                total: 0,
                active: 0,
                outOfStock: 0,
              },
            },
            settings: {
              notifications: {
                email: true,
                sms: false,
                orderUpdates: true,
                marketingEmails: false,
                pointsNotifications: true,
              },
              display: {
                showRating: true,
                showContactInfo: true,
                showMetrics: true,
                showPointsBalance: true,
              },
              security: {
                twoFactorAuth: false,
                loginNotifications: true,
              },
              customSite: {
                theme: 'default',
                primaryColor: '#000000',
              },
            },
            pointsBalance: 50,
            pointsTransactions: [
              {
                amount: 50,
                type: 'earn',
                description: 'Welcome bonus for new seller registration',
                createdAt: new Date(),
              },
            ],
            freeTrialActive: true,
            freeTrialEndDate: trialEndDate,
            trialMonthsUsed: 0,
            customSiteUrl,
          },
        ],
        { session }
      );

      // Update bank info separately
      const bankInfoResult = await updateBankInfo(userId, {
        accountName: data.bankInfo.accountName,
        accountNumber: data.bankInfo.accountNumber,
        bankName: data.bankInfo.bankName,
        swiftCode: data.bankInfo.swiftCode,
      }, locale);

      if (!bankInfoResult.success) {
        throw new SellerError(bankInfoResult.error || t('failedToUpdateBankInfo'), bankInfoResult.code || 'BANK_UPDATE_FAILED');
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          role: 'SELLER',
          businessProfile: seller[0]._id,
        },
        { new: true, session }
      );

      if (!updatedUser) {
        throw new SellerError(t('errors.failedToUpdateUserRole'), 'USER_UPDATE_FAILED');
      }

      await session.commitTransaction();
      revalidatePath('/[locale]/seller/dashboard', 'page');
      revalidatePath('/[locale]/account', 'page');

      await Promise.all([
        sendNotification({
          userId,
          type: 'welcome',
          title: t('messages.welcomeTitle'),
          message: t('messages.welcomeMessage'),
          data: { sellerId: seller[0]._id },
          channels: ['email', 'in_app', 'sms', 'whatsapp'],
        }),
        sendNotification({
          userId,
          type: 'points_earned',
          title: t('messages.bonusPointsTitle'),
          message: t('messages.bonusPointsMessage', { points: 50 }),
          data: { points: 50, sellerId: seller[0]._id },
          channels: ['email', 'in_app', 'sms'],
        }),
        sendNotification({
          userId,
          type: 'trial_reminder',
          title: t('messages.trialActiveTitle'),
          message: t('messages.trialActiveMessage', { trialDays: 5 }),
          data: { sellerId: seller[0]._id, trialDays: 5 },
          channels: ['email', 'in_app'],
        }),
      ]);

      return {
        success: true,
        data: seller[0],
        message: t('messages.success'),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Create seller error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.registrationFailed'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

const updateSellerSchema = z.object({
  businessName: z.string().min(2).max(100).optional(),
  description: z.string().min(50).max(500).optional(),
  logo: z.string().optional(),
  address: z
    .object({
      street: z.string().min(1).optional(),
      city: z.string().min(1).optional(),
      state: z.string().min(1).optional(),
      country: z.string().min(1).optional(),
      postalCode: z.string().min(1).optional(),
    })
    .optional(),
  settings: z
    .object({
      notifications: z
        .object({
          email: z.boolean().optional(),
          sms: z.boolean().optional(),
          orderUpdates: z.boolean().optional(),
          marketingEmails: z.boolean().optional(),
          pointsNotifications: z.boolean().optional(),
        })
        .optional(),
      display: z
        .object({
          showRating: z.boolean().optional(),
          showContactInfo: z.boolean().optional(),
          showMetrics: z.boolean().optional(),
          showPointsBalance: z.boolean().optional(),
        })
        .optional(),
      security: z
        .object({
          twoFactorAuth: z.boolean().optional(),
          loginNotifications: z.boolean().optional(),
        })
        .optional(),
      customSite: z
        .object({
          theme: z.string().optional(),
          primaryColor: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function updateSeller(userId: string, data: Partial<z.infer<typeof updateSellerSchema>>, logoFile?: File) {
  let t;
  try {
    t = await getTranslations({ locale: 'en', namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const validatedData = updateSellerSchema.parse(data);
    let logoUrl = validatedData.logo;

    if (logoFile) {
      const maxSize = 5 * 1024 * 1024;
      if (logoFile.size > maxSize) {
        throw new SellerError(t('errors.logoSizeExceeds'), 'INVALID_FILE');
      }
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(logoFile.type)) {
        throw new SellerError(t('errors.invalidLogoType'), 'INVALID_FILE');
      }
      const arrayBuffer = await logoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      logoUrl = await uploadToS3(buffer, `sellers/${userId}/logo`, {
        folder: 'sellers',
        resource_type: 'image',
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
        public_id: `${userId}-${Date.now()}`,
        overwrite: true,
      });
    }

    const updateData: any = { ...validatedData };
    if (logoUrl) updateData.logo = logoUrl;

    const seller = await Seller.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true }
    );

    if (!seller) throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');

    await sendNotification({
      userId,
      type: 'profile_updated',
      title: t('messages.profileUpdatedTitle'),
      message: t('messages.profileUpdatedMessage'),
      channels: ['in_app', 'email', 'sms', 'whatsapp'],
      data: { sellerId: seller._id },
    });

    return {
      success: true,
      seller: JSON.parse(JSON.stringify(seller)),
    };
  } catch (error) {
    console.error('Update seller error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToUpdateSeller'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function updateSellerSettings(userId: string, data: SettingsFormData, bannerFile?: File, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      if (seller.subscription.status !== 'active') {
        throw new SellerError(t('errors.inactiveSubscription'), 'INACTIVE_SUBSCRIPTION');
      }

      if (data.customSite?.customSections) {
        const planConfig = subscriptionPlans.find((p) => p.name === seller.subscription.plan);
        const limit = planConfig?.features.customSectionsLimit || 0;
        if (data.customSite.customSections.length > limit) {
          throw new SellerError(t('errors.customSectionsLimit', { limit }), 'CUSTOM_SECTIONS_LIMIT');
        }
      }

      let bannerUrl = seller.settings.customSite?.bannerImage;
      if (bannerFile && bannerFile.size > 0) {
        if (seller.settings.customSite?.bannerImage) {
          await deleteFromS3(seller.settings.customSite.bannerImage);
        }
        bannerUrl = await uploadToS3(bannerFile, `sellers/${userId}/banner`, {
          contentType: bannerFile.type,
          maxSize: 5 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
        });
      }

      if (data.customSiteUrl && data.customSiteUrl !== seller.customSiteUrl) {
        const urlExists = await Seller.exists({
          customSiteUrl: data.customSiteUrl,
          _id: { $ne: seller._id },
        });
        if (urlExists) {
          throw new SellerError(t('errors.customSiteUrlExists'), 'DUPLICATE_URL');
        }
        seller.customSiteUrl = data.customSiteUrl;
      }

      seller.businessName = data.businessName || seller.businessName;
      seller.description = data.description || seller.description;
      seller.phone = data.phone || seller.phone;
      seller.address = data.address || seller.address;

      if (data.bankInfo) {
        const bankInfoResult = await updateBankInfo(userId, {
          accountName: data.bankInfo.accountName,
          accountNumber: data.bankInfo.accountNumber,
          bankName: data.bankInfo.bankName,
          swiftCode: data.bankInfo.swiftCode,
        }, locale);

        if (!bankInfoResult.success) {
          throw new SellerError(bankInfoResult.error, bankInfoResult.code || 'BANK_UPDATE_FAILED');
        }
      }

      seller.settings = {
        notifications: {
          notifications: {
            email: data.notifications.email,
            sms: data.notifications.sms,
            orderUpdates: data.notifications.orderUpdates,
            marketingEmails: data.notifications.marketingEmails,
            pointsNotifications: data.notifications.pointsNotifications,
          },
        },
        display: data.display,
        security: data.security,
        customSite: {
          theme: data.customSite.theme,
          primaryColor: data.customSite.primaryColor,
          bannerImage: bannerUrl,
          customSections: data.customSite.customSections || [],
        },
      };

      await seller.save({ session });
      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/settings', 'page');
      revalidatePath(`/[locale]/${seller.customSiteUrl}`, 'page');

      await sendNotification({
        userId,
        type: 'settings_updated',
        title: t('messages.settingsUpdatedTitle'),
        message: t('messages.settingsUpdatedMessage'),
        channels: ['in_app', 'email', 'sms', 'whatsapp'],
        data: { sellerId: seller._id },
      });

      return {
        success: true,
        data: seller.settings,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Update seller settings error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToUpdateSettings'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function updateSellerSubscription(
  userId: string,
  plan: SubscriptionPlan,
  pointsToRedeem: number = 0,
  paymentMethod?: 'stripe' | 'paypal' | 'points',
  paymentDetails?: { stripeSessionId?: string; paypalOrderId?: string },
  locale: string = 'en'
) {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }
      if (!seller.bankInfo.verified) {
        throw new SellerError(t('errors.bankInfoNotVerified'), 'BANK_NOT_VERIFIED');
      }

      const settings = await getSetting();
      const validPlans: SubscriptionPlan[] = ['Trial', 'Basic', 'Pro', 'VIP'];
      if (!validPlans.includes(plan)) {
        throw new SellerError(t('errors.invalidPlan'), 'INVALID_PLAN');
      }

      const planConfig = subscriptionPlans.find((p) => p.name === plan);
      if (!planConfig) {
        throw new SellerError(t('errors.invalidPlanConfig'), 'INVALID_PLAN_CONFIG');
      }

      const isTrial = plan === 'Trial';
      const durationDays = isTrial ? 90 : 30;
      const endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

      if (isTrial && (seller.trialMonthsUsed || 0) >= 1) {
        throw new SellerError(t('errors.trialExhausted'), 'TRIAL_EXHAUSTED');
      }

      let finalCost = planConfig.price;
      let paymentId: string | undefined;

      if (pointsToRedeem > 0) {
        if (seller.pointsBalance < pointsToRedeem) {
          throw new SellerError(t('errors.insufficientPoints'), 'INSUFFICIENT_POINTS');
        }
        const pointsValue = settings.points?.redeemValue || 0.05;
        const discount = round2(pointsToRedeem * pointsValue);
        if (discount > finalCost) {
          throw new SellerError(t('errors.invalidRedemption'), 'INVALID_REDEMPTION');
        }
        finalCost -= discount;
        seller.pointsBalance -= pointsToRedeem;
        seller.pointsTransactions.push({
          amount: pointsToRedeem,
          type: 'redeem',
          description: `Redeemed points for ${plan} subscription`,
          createdAt: new Date(),
        });
      }

      if (finalCost > 0) {
        if (!paymentMethod || !paymentDetails) {
          throw new SellerError(t('errors.invalidPayment'), 'INVALID_PAYMENT');
        }
        if (paymentMethod === 'stripe' && paymentDetails.stripeSessionId) {
          const stripeSession = await stripe.checkout.sessions.retrieve(paymentDetails.stripeSessionId);
          if (stripeSession.payment_status !== 'paid') {
            console.error(`Stripe payment failed for session ${paymentDetails.stripeSessionId}: ${stripeSession.payment_status}`);
            throw new SellerError(t('errors.paymentFailed'), 'PAYMENT_FAILED');
          }
          paymentId = stripeSession.payment_intent as string;
        } else if (paymentMethod === 'paypal' && paymentDetails.paypalOrderId) {
          const request = new paypal.orders.OrdersGetRequest(paymentDetails.paypalOrderId);
          const order = await paypalClient.execute(request);
          if (order.result.status !== 'COMPLETED') {
            console.error(`PayPal payment failed for order ${paymentDetails.paypalOrderId}: ${order.result.status}`);
            throw new SellerError(t('errors.paymentFailed'), 'PAYMENT_FAILED');
          }
          paymentId = paymentDetails.paypalOrderId;
        } else if (paymentMethod !== 'points') {
          throw new SellerError(t('errors.invalidPayment'), 'INVALID_PAYMENT');
        }
      }

      seller.subscription = {
        plan,
        startDate: new Date(),
        endDate,
        status: 'active',
        features: planConfig.features,
        pointsRedeemed: pointsToRedeem,
        paymentMethod,
        paymentId,
      };

      if (isTrial) {
        seller.trialMonthsUsed = (seller.trialMonthsUsed || 0) + 1;
        seller.freeTrialActive = true;
        seller.freeTrialEndDate = endDate;
      } else {
        seller.freeTrialActive = false;
        seller.freeTrialEndDate = undefined;
      }

      await seller.save({ session });
      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard', 'page');
      revalidatePath('/[locale]/account/subscriptions', 'page');

      await Promise.all([
        sendNotification({
          userId,
          type: 'subscription_updated',
          title: t('messages.subscriptionUpdatedTitle'),
          message: t('messages.subscriptionUpdatedMessage', { plan, points: pointsToRedeem }),
          data: { sellerId: seller._id, plan },
          channels: ['in_app', 'email', 'sms', 'whatsapp'],
        }),
        pointsToRedeem > 0 &&
          sendNotification({
            userId,
            type: 'points_redeemed',
            title: t('messages.pointsRedeemedTitle'),
            message: t('messages.pointsRedeemedMessage', { points: pointsToRedeem, plan }),
            data: { points: pointsToRedeem, sellerId: seller._id },
            channels: ['in_app', 'email', 'sms'],
          }),
      ].filter(Boolean));

      return {
        success: true,
        data: seller.subscription,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Update subscription error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToUpdateSubscription'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function awardSellerPoints(
  userId: string,
  amount: number,
  description: string,
  orderId?: string,
  locale: string = 'en'
) {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      if (amount <= 0) {
        throw new SellerError(t('errors.invalidAmount'), 'INVALID_AMOUNT');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      await seller.addPoints(amount, description, orderId);
      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard', 'page');
      revalidatePath('/[locale]/account', 'page');

      await sendNotification({
        userId,
        type: 'points_earned',
        title: t('messages.pointsEarnedTitle'),
        message: t('messages.pointsEarnedMessage', { points: amount, description }),
        data: { points: amount, sellerId: seller._id },
        channels: ['in_app', 'email', 'sms', 'whatsapp'],
      });

      return {
        success: true,
        data: { pointsBalance: seller.pointsBalance },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Award points error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToAwardPoints'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function getSellerMetrics(userId: string, locale: string = 'en'): Promise<SellerMetrics> {
  performance.mark(PERFORMANCE_MARKERS.START);
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();

    if (!isValidObjectId(userId)) {
      throw new SellerError(t('invalidSellerData'), 'INVALID_ID');
    }

    const seller = await Seller.findOne({ userId })
      .select('-bankInfo.accountNumber')
      .lean();

    if (!seller) {
      throw new SellerError(t('sellerNotFound'), 'NOT_FOUND');
    }

    const now = new Date();
    const dayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [
      dailyRevenue,
      weeklyRevenue,
      monthlyRevenue,
      yearlyRevenue,
      orderStats,
      productStats,
      performanceStats,
      analyticsStats,
      pointsStats,
    ] = await Promise.all([
      calculateRevenueHelper(seller._id, dayStart),
      calculateRevenueHelper(seller._id, weekStart),
      calculateRevenueHelper(seller._id, monthStart),
      calculateRevenueHelper(seller._id, yearStart),
      calculateOrderStats(seller._id),
      calculateProductStats(seller._id),
      calculatePerformanceStats(seller._id),
      calculateAnalyticsStats(seller._id),
      calculatePointsStats(seller._id),
    ]);

    const trend = await calculateTrendHelper(dailyRevenue.total, weeklyRevenue.average);
    const percentage = await calculateGrowthPercentageHelper(monthlyRevenue.total, monthlyRevenue.previous);

    const metrics: SellerMetrics = {
      revenue: {
        daily: round2(dailyRevenue.total),
        weekly: round2(weeklyRevenue.total),
        monthly: round2(monthlyRevenue.total),
        yearly: round2(yearlyRevenue.total),
        trend,
        percentage: round2(percentage),
      },
      orders: orderStats,
      products: productStats,
      performance: performanceStats,
      analytics: analyticsStats,
      points: pointsStats,
    };

    performance.mark(PERFORMANCE_MARKERS.END);
    performance.measure('getSellerMetrics Duration', PERFORMANCE_MARKERS.START, PERFORMANCE_MARKERS.END);

    return metrics;
  } catch (error) {
    console.error('Get seller metrics error:', error);
    throw new SellerError(
      error instanceof SellerError ? error.message : t('failedToCalculateMetrics'),
      error instanceof SellerError ? error.code : 'METRICS_ERROR'
    );
  }
}

export async function updateBankInfo(
  userId: string,
  bankInfo: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode: string;
  },
  locale: string = 'en'
) {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!mongoose.isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      // Local validation
      if (!isValidIBAN(bankInfo.accountNumber)) {
        throw new SellerError(t('errors.invalidIBAN'), 'INVALID_IBAN');
      }

      if (!SWIFT_REGEX.test(bankInfo.swiftCode)) {
        throw new SellerError(t('errors.invalidSwift'), 'INVALID_SWIFT');
      }

      // External verification via API Route
      const verificationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/verify-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iban: bankInfo.accountNumber, swift: bankInfo.swiftCode }),
      });
      const verificationResult = await verificationResponse.json();

      if (!verificationResult.valid) {
        throw new SellerError(
          t('errors.externalVerificationFailed', { message: verificationResult.message }),
          'EXTERNAL_VERIFICATION_FAILED'
        );
      }

      // Create or update Stripe Connect account
      let stripeAccountId = seller.stripeAccountId;
      if (!stripeAccountId) {
        const account = await stripe.accounts.create({
          type: 'custom',
          country: 'US', // Adjust based on seller's country
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

      // Add bank account to Stripe
      await stripe.accounts.createExternalAccount(stripeAccountId, {
        external_account: {
          object: 'bank_account',
          country: 'US', // Adjust based on seller's country
          currency: 'usd',
          account_holder_name: bankInfo.accountName,
          account_number: bankInfo.accountNumber,
          routing_number: bankInfo.swiftCode,
        },
      });

      // Encrypt accountNumber
      const encryptedAccountNumber = await encrypt(bankInfo.accountNumber);

      // Update seller bank info
      seller.bankInfo = {
        accountName: bankInfo.accountName,
        accountNumber: encryptedAccountNumber,
        bankName: bankInfo.bankName,
        swiftCode: bankInfo.swiftCode,
        verified: verificationResult.valid,
      };
      seller.stripeAccountId = stripeAccountId;

      await seller.save({ session });
      await session.commitTransaction();

      return {
        success: true,
        message: t('messages.bankInfoUpdated'),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Update bank info error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToUpdateBankInfo'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}


export const getCachedSellerMetrics = cache(async (userId: string, locale: string = 'en') => {
  return getSellerMetrics(userId, locale);
});

export async function getProducts(userId: string, filters: ProductFilters = {}, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();

    if (!isValidObjectId(userId)) {
      throw new SellerError(t('invalidSellerData'), 'INVALID_ID');
    }

    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('sellerNotFound'), 'NOT_FOUND');
    }

    const query: any = { sellerId: seller._id };
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
      ];
    }
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.category) {
      query.category = filters.category;
    }

    const sort: Record<string, 1 | -1> = {};
    if (filters.sortBy) {
      sort[filters.sortBy] = filters.sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, filters.limit || 10);
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
    ]);

    return {
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };
  } catch (error) {
    console.error('Get products error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('failedToGetProducts'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}



export async function rotateSellerApiKey(
  userId: string,
  apiKeyId: string,
  locale: string = 'en'
) {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId) || !isValidObjectId(apiKeyId)) {
        throw new SellerError(t('errors.invalidData'), 'INVALID_ID');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      const apiKey = await ApiKey.findOne({ _id: apiKeyId, sellerId: seller._id });
      if (!apiKey) {
        throw new SellerError(t('errors.apiKeyNotFound'), 'API_KEY_NOT_FOUND');
      }

      const serverSession = await auth();
      const currentUser = serverSession?.user?.id || 'system';

      const rotatedApiKey = await ApiKeyService.rotateApiKey(apiKeyId, {
        updatedBy: currentUser,
      });

      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/settings/security', 'page');

      await sendNotification({
        userId,
        type: 'api_key_rotated',
        title: t('messages.apiKeyRotatedTitle'),
        message: t('messages.apiKeyRotatedMessage', { name: rotatedApiKey.name }),
        data: { sellerId: seller._id, apiKeyId: rotatedApiKey._id },
      });

      return {
        success: true,
        data: rotatedApiKey,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Rotate API key error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.apiKeyRotationFailed'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}


export async function deactivateSellerApiKey(
  userId: string,
  apiKeyId: string,
  locale: string = 'en'
) {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId) || !isValidObjectId(apiKeyId)) {
        throw new SellerError(t('errors.invalidData'), 'INVALID_ID');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      const apiKey = await ApiKey.findOne({ _id: apiKeyId, sellerId: seller._id });
      if (!apiKey) {
        throw new SellerError(t('errors.apiKeyNotFound'), 'API_KEY_NOT_FOUND');
      }

      const serverSession = await auth();
      const currentUser = serverSession?.user?.id || 'system';

      await ApiKeyService.deactivateApiKey(apiKeyId, { updatedBy: currentUser });

      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/settings/security', 'page');

      await sendNotification({
        userId,
        type: 'api_key_deactivated',
        title: t('messages.apiKeyDeactivatedTitle'),
        message: t('messages.apiKeyDeactivatedMessage', { name: apiKey.name }),
        data: { sellerId: seller._id, apiKeyId },
      });

      return {
        success: true,
        message: t('messages.apiKeyDeactivated'),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Deactivate API key error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.apiKeyDeactivationFailed'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}


export async function getSellerOrders(userId: string, filters: OrderFilters = {}, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();

    if (!isValidObjectId(userId)) {
      throw new SellerError(t('invalidSellerData'), 'INVALID_ID');
    }

    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('sellerNotFound'), 'NOT_FOUND');
    }

    const query: any = { sellerId: seller._id };
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = filters.startDate;
      }
      if (filters.endDate) {
        query.createdAt.$lte = filters.endDate;
      }
    }

    const sort: Record<string, 1 | -1> = {};
    if (filters.sortBy) {
      sort[filters.sortBy] = -1;
    } else {
      sort.createdAt = -1;
    }

    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, filters.limit || 10);
    const skip = (page - 1) * limit;

    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email')
        .lean(),
      Order.countDocuments(query),
    ]);

    return {
      success: true,
      data: {
        orders,
        currentPage: page,
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
      },
    };
  } catch (error) {
    console.error('Get seller orders error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('failedToGetOrders'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function updateSellerMetrics(
  sellerId: string,
  data: {
    productsCount?: number;
    lastProductCreated?: Date;
    action: string;
  },
  locale: string = 'en'
) {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(sellerId)) {
        throw new SellerError(t('invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findById(sellerId).session(session);
      if (!seller) {
        throw new SellerError(t('sellerNotFound'), 'NOT_FOUND');
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (typeof data.productsCount === 'number') {
        updateData['metrics.productsCount'] = Math.max(0, data.productsCount);
      }

      if (data.action === 'product_created') {
        updateData['metrics.lastProductCreated'] = data.lastProductCreated || new Date();
        updateData['metrics.products.total'] = (seller.metrics.products?.total || 0) + 1;
        updateData['metrics.products.active'] = (seller.metrics.products?.active || 0) + 1;
      } else if (data.action === 'product_deleted') {
        updateData['metrics.products.total'] = Math.max(0, (seller.metrics.products?.total || 0) - 1);
        updateData['metrics.products.active'] = Math.max(0, (seller.metrics.products?.active || 0) - 1);
      } else if (data.action === 'product_out_of_stock') {
        updateData['metrics.products.active'] = Math.max(0, (seller.metrics.products?.active || 0) - 1);
        updateData['metrics.products.outOfStock'] = (seller.metrics.products?.outOfStock || 0) + 1;
      } else if (data.action === 'product_back_in_stock') {
        updateData['metrics.products.active'] = (seller.metrics.products?.active || 0) + 1;
        updateData['metrics.products.outOfStock'] = Math.max(0, (seller.metrics.products?.outOfStock || 0) - 1);
      }

      const updatedSeller = await Seller.findByIdAndUpdate(
        sellerId,
        { $set: updateData },
        { new: true, session }
      ).select('-bankInfo.accountNumber');

      if (!updatedSeller) {
        throw new SellerError(t('failedToUpdateMetrics'), 'UPDATE_FAILED');
      }

      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard', 'page');
      revalidatePath('/[locale]/seller/dashboard/products', 'page');
      revalidatePath('/[locale]/admin/sellers', 'page');

      return {
        success: true,
        data: updatedSeller,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Update seller metrics error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('failedToUpdateMetrics'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function uploadSellerDocument(userId: string, document: DocumentUpload, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      if (!document.file || document.file.size === 0) {
        throw new SellerError(t('errors.invalidFile'), 'INVALID_FILE');
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (document.file.size > maxSize) {
        throw new SellerError(t('errors.fileSizeExceeds'), 'FILE_SIZE_EXCEEDED');
      }

      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(document.file.type)) {
        throw new SellerError(t('errors.invalidFileType'), 'INVALID_FILE_TYPE');
      }

      const documentUrl = await uploadToS3(document.file, `sellers/${userId}/documents/${document.type}-${Date.now()}`, {
        contentType: document.file.type,
        maxSize,
        allowedTypes,
      });

      const verification = new DocumentVerification();
      const verificationResult = await verification.verifyDocument({
        fileUrl: documentUrl,
        type: document.type,
        metadata: document.metadata,
      });

      seller.verification.documents.set(document.type, {
        url: documentUrl,
        type: document.type,
        status: verificationResult.status,
        verifiedAt: verificationResult.status === 'verified' ? new Date() : undefined,
        metadata: document.metadata,
      });

      seller.verification.status = verificationResult.status;
      if (verificationResult.status === 'verified') {
        seller.verification.verifiedAt = new Date();
      }

      await seller.save({ session });
      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/verification', 'page');

      await sendNotification({
        userId,
        type: 'document_uploaded',
        title: t('messages.documentUploadedTitle'),
        message: t('messages.documentUploadedMessage', { type: document.type }),
        data: { sellerId: seller._id, documentType: document.type },
        channels: ['in_app', 'email', 'sms', 'whatsapp'],
      });

      return {
        success: true,
        data: {
          documentUrl,
          verificationStatus: verificationResult.status,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Upload seller document error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToUploadDocument'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function distributeEarnings(sellerId: string, period: 'daily' | 'weekly' | 'monthly', locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(sellerId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findById(sellerId).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      if (!seller.bankInfo.verified) {
        throw new SellerError(t('errors.bankInfoNotVerified'), 'BANK_NOT_VERIFIED');
      }

      const now = new Date();
      let startDate: Date;
      switch (period) {
        case 'daily':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'weekly':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          throw new SellerError(t('errors.invalidPeriod'), 'INVALID_PERIOD');
      }

      const earnings = await getSellerEarnings(sellerId, startDate, now);
      if (earnings <= 0) {
        throw new SellerError(t('errors.noEarnings'), 'NO_EARNINGS');
      }

      const commissionRate = seller.subscription.features.commission / 100;
      const netEarnings = earnings * (1 - commissionRate);
      const platformFee = earnings * commissionRate;

      // فك تشفير accountNumber
      let decryptedAccountNumber = seller.bankInfo.accountNumber;
      if (decryptedAccountNumber.includes(':')) {
        decryptedAccountNumber = await decrypt(decryptedAccountNumber);
      }

      // Process payout (using Stripe for example)
      const payout = await stripe.payouts.create({
        amount: Math.round(netEarnings * 100), // Convert to cents
        currency: 'usd',
        destination: decryptedAccountNumber,
        description: `Payout for ${period} earnings`,
      });

      // Update seller earnings history
      seller.earningsHistory = seller.earningsHistory || [];
      seller.earningsHistory.push({
        amount: netEarnings,
        commission: platformFee,
        period,
        payoutId: payout.id,
        status: 'completed',
        createdAt: new Date(),
      });

      seller.metrics.totalRevenue += netEarnings;
      await seller.save({ session });

      // Update platform earnings (optional, for admin tracking)
      await Seller.updateOne(
        { _id: process.env.PLATFORM_SELLER_ID },
        {
          $inc: { 'metrics.totalRevenue': platformFee },
          $push: {
            earningsHistory: {
              amount: platformFee,
              commission: 0,
              period,
              payoutId: payout.id,
              status: 'completed',
              createdAt: new Date(),
            },
          },
        },
        { session }
      );

      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/earnings', 'page');

      await sendNotification({
        userId: seller.userId,
        type: 'earnings_distributed',
        title: t('messages.earningsDistributedTitle'),
        message: t('messages.earningsDistributedMessage', {
          amount: netEarnings,
          period,
        }),
        data: {
          sellerId: seller._id,
          amount: netEarnings,
          period,
          payoutId: payout.id,
        },
        channels: ['in_app', 'email', 'sms', 'whatsapp'],
      });

      return {
        success: true,
        data: {
          earnings: netEarnings,
          commission: platformFee,
          payoutId: payout.id,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Distribute earnings error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToDistributeEarnings'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function someSellerAction(userId: string, productId: string, action: string, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId) || !isValidObjectId(productId)) {
        throw new SellerError(t('errors.invalidData'), 'INVALID_DATA');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      const product = await Product.findById(productId).session(session);
      if (!product || product.sellerId.toString() !== seller._id.toString()) {
        throw new SellerError(t('errors.productNotFound'), 'PRODUCT_NOT_FOUND');
      }

      let notificationType: NotificationType;
      let notificationMessage: string;
      let updateData: any = {};

      switch (action) {
        case 'publish':
          if (product.status === 'active') {
            throw new SellerError(t('errors.productAlreadyPublished'), 'ALREADY_PUBLISHED');
          }
          updateData.status = 'active';
          notificationType = 'product_published';
          notificationMessage = t('messages.productPublishedMessage', { productName: product.name });
          break;

        case 'unpublish':
          if (product.status === 'draft') {
            throw new SellerError(t('errors.productAlreadyUnpublished'), 'ALREADY_UNPUBLISHED');
          }
          updateData.status = 'draft';
          notificationType = 'product_unpublished';
          notificationMessage = t('messages.productUnpublishedMessage', { productName: product.name });
          break;

        case 'delete':
          await Product.findByIdAndDelete(productId, { session });
          await updateSellerMetrics(seller._id.toString(), {
            productsCount: (seller.metrics.productsCount || 0) - 1,
            action: 'product_deleted',
          }, locale);
          notificationType = 'product_deleted';
          notificationMessage = t('messages.productDeletedMessage', { productName: product.name });
          break;

        default:
          throw new SellerError(t('errors.invalidAction'), 'INVALID_ACTION');
      }

      if (action !== 'delete') {
        await Product.findByIdAndUpdate(productId, { $set: updateData }, { session });
      }

      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/products', 'page');
      revalidatePath(`/[locale]/${seller.customSiteUrl}`, 'page');

      await sendNotification({
        userId,
        type: notificationType,
        title: t(`messages.${notificationType}Title`),
        message: notificationMessage,
        data: { productId, sellerId: seller._id },
        channels: ['in_app', 'email', 'sms', 'whatsapp'],
      });

      return {
        success: true,
        message: notificationMessage,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Seller action error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToPerformAction'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

// New Functions for Product Management
export async function createProduct(
  userId: string,
  data: {
    name: string;
    description: string;
    price: number;
    countInStock: number;
    category: string;
    images?: File[];
    status?: 'active' | 'draft';
  },
  locale: string = 'en'
) {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      if (seller.subscription.status !== 'active') {
        throw new SellerError(t('errors.inactiveSubscription'), 'INACTIVE_SUBSCRIPTION');
      }

      const productLimit = seller.subscription.features.productsLimit || 50;
      const currentProducts = await Product.countDocuments({ sellerId: seller._id });
      if (currentProducts >= productLimit) {
        throw new SellerError(t('errors.productLimitReached', { limit: productLimit }), 'PRODUCT_LIMIT');
      }

      let imageUrls: string[] = [];
      if (data.images && data.images.length > 0) {
        imageUrls = await Promise.all(
          data.images.map((file, index) =>
            uploadToS3(file, `sellers/${userId}/products/${data.name}-${index}-${Date.now()}`, {
              contentType: file.type,
              maxSize: 5 * 1024 * 1024,
              allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
            })
          )
        );
      }

      const product = await Product.create(
        [
          {
            sellerId: seller._id,
            name: data.name,
            description: data.description,
            price: data.price,
            countInStock: data.countInStock,
            category: data.category,
            images: imageUrls,
            status: data.status || 'draft',
            metrics: {
              rating: 0,
              sales: 0,
              views: 0,
            },
          },
        ],
        { session }
      );

      await updateSellerMetrics(seller._id.toString(), {
        productsCount: currentProducts + 1,
        action: 'product_created',
        lastProductCreated: new Date(),
      }, locale);

      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/products', 'page');
      revalidatePath(`/[locale]/${seller.customSiteUrl}`, 'page');

      await sendNotification({
        userId,
        type: 'product_created',
        title: t('messages.productCreatedTitle'),
        message: t('messages.productCreatedMessage', { productName: data.name }),
        data: { productId: product[0]._id, sellerId: seller._id },
        channels: ['in_app', 'email', 'sms', 'whatsapp'],
      });

      return {
        success: true,
        data: product[0],
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Create product error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToCreateProduct'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function updateProduct(
  userId: string,
  productId: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    countInStock?: number;
    category?: string;
    images?: File[];
    status?: 'active' | 'draft';
  },
  locale: string = 'en'
) {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!isValidObjectId(userId) || !isValidObjectId(productId)) {
        throw new SellerError(t('errors.invalidData'), 'INVALID_DATA');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      const product = await Product.findById(productId).session(session);
      if (!product || product.sellerId.toString() !== seller._id.toString()) {
        throw new SellerError(t('errors.productNotFound'), 'PRODUCT_NOT_FOUND');
      }

      let imageUrls = product.images;
      if (data.images && data.images.length > 0) {
        // Delete old images
        if (imageUrls.length > 0) {
          await Promise.all(imageUrls.map((url) => deleteFromS3(url)));
        }
        // Upload new images
        imageUrls = await Promise.all(
          data.images.map((file, index) =>
            uploadToS3(file, `sellers/${userId}/products/${data.name || product.name}-${index}-${Date.now()}`, {
              contentType: file.type,
              maxSize: 5 * 1024 * 1024,
              allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
            })
          )
        );
      }

      const wasOutOfStock = product.countInStock === 0;
      const willBeOutOfStock = data.countInStock === 0;

      const updateData: any = {
        name: data.name || product.name,
        description: data.description || product.description,
        price: data.price !== undefined ? data.price : product.price,
        countInStock: data.countInStock !== undefined ? data.countInStock : product.countInStock,
        category: data.category || product.category,
        images: imageUrls,
        status: data.status || product.status,
        updatedAt: new Date(),
      };

      await Product.findByIdAndUpdate(productId, { $set: updateData }, { session });

      // Update seller metrics if stock status changes
      if (wasOutOfStock && !willBeOutOfStock) {
        await updateSellerMetrics(seller._id.toString(), {
          action: 'product_back_in_stock',
        }, locale);
      } else if (!wasOutOfStock && willBeOutOfStock) {
        await updateSellerMetrics(seller._id.toString(), {
          action: 'product_out_of_stock',
        }, locale);
      }

      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/products', 'page');
      revalidatePath(`/[locale]/${seller.customSiteUrl}`, 'page');
      revalidatePath(`/[locale]/products/${productId}`, 'page');

      await sendNotification({
        userId,
        type: 'product_updated',
        title: t('messages.productUpdatedTitle'),
        message: t('messages.productUpdatedMessage', { productName: data.name || product.name }),
        data: { productId, sellerId: seller._id },
        channels: ['in_app', 'email', 'sms', 'whatsapp'],
      });

      return {
        success: true,
        data: {
          ...product.toObject(),
          ...updateData,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Update product error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToUpdateProduct'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}
export async function deleteProduct(userId: string, productId: string, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }
  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (!isValidObjectId(userId) || !isValidObjectId(productId)) {
        throw new SellerError(t('errors.invalidData'), 'INVALID_DATA');
      }
      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }
      const product = await Product.findById(productId).session(session);
      if (!product || product.sellerId.toString() !== seller._id.toString()) {
        throw new SellerError(t('errors.productNotFound'), 'PRODUCT_NOT_FOUND');
      }
      await Product.findByIdAndDelete(productId, { session });
      await updateSellerMetrics(seller._id.toString(), {
        action: 'product_deleted',
      }, locale);
      await session.commitTransaction();
      revalidatePath('/[locale]/seller/dashboard/products', 'page');
      revalidatePath(`/[locale]/${seller.customSiteUrl}`, 'page');
      await sendNotification({
        userId,
        type: 'product_deleted',
        title: t('messages.productDeletedTitle'),
        message: t('messages.productDeletedMessage', { productName: product.name }),
        data: { productId, sellerId: seller._id },
        channels: ['in_app', 'email', 'sms', 'whatsapp'],
      });
      return {
        success: true,
        message: t('messages.productDeletedMessage', { productName: product.name }),
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Delete product error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToDeleteProduct'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function getSellerByCustomSiteUrl(customSiteUrl: string, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();

    const seller = await Seller.findOne({ customSiteUrl }).lean();
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    return {
      success: true,
      data: seller,
    };
  } catch (error) {
    console.error('Get seller by customSiteUrl error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToFetchSeller'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function getAllSellers(
  {
    page = 1,
    limit = 10,
    search,
    status,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  }: {
    page?: number
    limit?: number
    search?: string
    status?: SubscriptionStatus
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  },
  locale: string = 'en'
) {
  let t
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' })
  } catch (error) {
    console.error('Failed to load translations:', error)
    t = (key: string) => key
  }

  try {
    await connectToDatabase()

    const serverSession = await auth()
    if (!serverSession?.user || serverSession.user.role !== 'Admin') {
      throw new SellerError(t('unauthorized'), 'UNAUTHORIZED')
    }

    const query: any = {}
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ]
    }
    if (status) {
      query['subscription.status'] = status
    }

    const sort: Record<string, 1 | -1> = {}
    if (sortBy) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1
    } else {
      sort.createdAt = -1
    }

    const skip = (page - 1) * limit

    const [sellers, total] = await Promise.all([
      Seller.find(query)
        .select('-bankInfo.accountNumber')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Seller.countDocuments(query),
    ])

    return {
      success: true,
      data: {
        sellers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    }
  } catch (error) {
    console.error('Get all sellers error:', error)
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('failedToGetSellers'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    }
  }
}

export async function getSellers(
  {
    page = 1,
    pageSize = 10,
    search = '',
  }: {
    page?: number
    pageSize?: number
    search?: string
  },
  locale: string = 'en'
) {
  let t
  try {
    t = await getTranslations({ locale, namespace: 'api.errors' })
  } catch (error) {
    console.error('Failed to load translations:', error)
    t = (key: string) => key
  }

  try {
    await connectToDatabase()

    const serverSession = await auth()
    if (!serverSession?.user || serverSession.user.role !== 'Admin') {
      throw new SellerError(t('unauthorized'), 'UNAUTHORIZED')
    }

    const query: any = {}
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ]
    }

    const sort: Record<string, 1 | -1> = { createdAt: -1 }
    const skip = (page - 1) * pageSize

    const [sellers, total] = await Promise.all([
      Seller.find(query)
        .select('-bankInfo.accountNumber')
        .sort(sort)
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Seller.countDocuments(query),
    ])

    return {
      sellers,
      total,
    }
  } catch (error) {
    console.error('Get sellers error:', error)
    throw new SellerError(
      error instanceof SellerError ? error.message : t('failedToGetSellers'),
      error instanceof SellerError ? error.code : 'UNKNOWN'
    )
  }
}


export async function deleteSeller(userId: string, locale: string = 'en') {
  let t
  try {
    t = await getTranslations({ locale, namespace: 'api' })
  } catch (error) {
    console.error('Failed to load translations:', error)
    t = (key: string) => key
  }

  try {
    await connectToDatabase()
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      if (!isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID')
      }

      const serverSession = await auth()
      if (!serverSession?.user || serverSession.user.role !== 'Admin') {
        throw new SellerError(t('errors.unauthorized'), 'UNAUTHORIZED')
      }

      const seller = await Seller.findOne({ userId }).session(session)
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND')
      }

      await Promise.all([
        Product.deleteMany({ sellerId: seller._id }).session(session),
        Order.deleteMany({ sellerId: seller._id }).session(session),
        seller.logo && deleteFromS3(seller.logo),
        seller.settings.customSite?.bannerImage && deleteFromS3(seller.settings.customSite.bannerImage),
        ...Array.from(seller.verification.documents.values()).map((doc: any) =>
          doc.url && deleteFromS3(doc.url)
        ),
      ])

      await Seller.deleteOne({ _id: seller._id }).session(session)

      await User.findByIdAndUpdate(
        userId,
        {
          role: 'user',
          businessProfile: null,
        },
        { session }
      )

      await session.commitTransaction()

      revalidatePath('/[locale]/seller/dashboard', 'page')
      revalidatePath('/[locale]/account', 'page')
      revalidatePath('/[locale]/admin/sellers', 'page')

      return {
        success: true,
        message: t('messages.sellerDeleted'),
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  } catch (error) {
    console.error('Delete seller error:', error)
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToDeleteSeller'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    }
  }
}

export async function suspendSeller(sellerId: string, reason: string, locale: string = 'en') {
  let t
  try {
    t = await getTranslations({ locale, namespace: 'api' })
  } catch (error) {
    console.error('Failed to load translations:', error)
    t = (key: string) => key
  }

  try {
    await connectToDatabase()
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      if (!isValidObjectId(sellerId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID')
      }

      const serverSession = await auth()
      if (!serverSession?.user || serverSession.user.role !== 'Admin') {
        throw new SellerError(t('errors.unauthorized'), 'UNAUTHORIZED')
      }

      const seller = await Seller.findById(sellerId).session(session)
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND')
      }

      seller.subscription.status = 'suspended'
      seller.updatedAt = new Date()

      await seller.save({ session })
      await session.commitTransaction()

      revalidatePath('/[locale]/seller/dashboard', 'page')
      revalidatePath('/[locale]/admin/sellers', 'page')

      await sendNotification({
        userId: seller.userId,
        type: 'account_suspended',
        title: t('messages.accountSuspendedTitle'),
        message: t('messages.accountSuspendedMessage', { reason }),
        data: { sellerId: seller._id, reason },
      })

      return {
        success: true,
        data: seller,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  } catch (error) {
    console.error('Suspend seller error:', error)
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToSuspendSeller'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    }
  }
}


export async function getProductReviews(userId: string, productId: string, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }
  try {
    await connectToDatabase();
    if (!isValidObjectId(userId) || !isValidObjectId(productId)) {
      throw new SellerError(t('errors.invalidData'), 'INVALID_DATA');
    }
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }
    const product = await Product.findById(productId).populate('reviews.userId', 'name email');
    if (!product || product.sellerId.toString() !== seller._id.toString()) {
      throw new SellerError(t('errors.productNotFound'), 'PRODUCT_NOT_FOUND');
    }
    return {
      success: true,
      data: product.reviews,
    };
  } catch (error) {
    console.error('Get product reviews error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToGetReviews'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}


async function decryptAccountNumber(seller: ISeller): Promise<ISeller> {
  if (
    seller.bankInfo?.accountNumber &&
    typeof seller.bankInfo.accountNumber === 'string' &&
    seller.bankInfo.accountNumber.includes(':')
  ) {
    try {
      seller.bankInfo.accountNumber = await decrypt(seller.bankInfo.accountNumber);
    } catch (error: unknown) {
      console.error(
        `Failed to decrypt account number for seller ${seller._id}:`,
        (error as Error).message
      );
      throw new SellerError('Failed to decrypt bank account number', 'DECRYPTION_ERROR');
    }
  } else {
    console.warn(`No encrypted account number found for seller ${seller._id}`);
    seller.bankInfo.accountNumber = '';
    seller.bankInfo.verified = false;
  }
  return seller;
}