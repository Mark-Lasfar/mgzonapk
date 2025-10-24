'use server';

import { connectToDatabase } from '@/lib/db';
import Seller, { ISeller } from '@/lib/db/models/seller.model';
import User from '@/lib/db/models/user.model';
// import Order from '@/lib/db/models/order.model';
import Product from '@/lib/db/models/product.model';
import mongoose from 'mongoose';
import { revalidatePath } from 'next/cache';
// import { uploadToStorage, deleteFromStorage } from '@/lib/utils/s3'; // تم تصحيح uploadToS3 إلى uploadToStorage
import { uploadToStorage as uploadToCloudinary, uploadToStorage } from '@/lib/utils/cloudinary';
import { sendNotification } from '@/lib/utils/notification';
// import { sendNotification } from '@/lib/actions/notification.actions';

import { DocumentVerification } from '@/lib/utils/verification';
import { cache } from 'react';
import { getSetting } from './setting.actions';
import { round2 } from '@/lib/utils';
// import { auth } from '@/auth';
// import { getSubscriptionPlans } from '@/lib/constants';
import { ApiKeyService } from '@/lib/api/services/api-key.service';
import { z } from 'zod';
import { decrypt, encrypt } from '../utils/encryption';
// import { isValidIBAN } from 'iban';
import SubscriptionOrder from '@/lib/db/models/subscription-order.model';

import { getLocale, getTranslations } from 'next-intl/server';
// import { getSafeTranslations } from '@/lib/utils';
import Integration, { IIntegration } from '@/lib/db/models/integration.model';

// import { getServerSession } from 'next-auth';
// import { authOptions } from '@/auth';
// import { getTranslations } from '@/lib/i18n';
import { getSubscriptionPlans, SubscriptionPlan } from '@/lib/constants';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';

// import { logger } from '@/lib/utils/logger';
import { NextResponse } from 'next/server';
// import { getSubscriptionPlans } from '../constants';
import { auth, authenticateUser } from '@/auth';
import { customLogger, logger } from '../services/logging';
// import { emailService } from '../services/email/mailer';
import { ObjectId } from 'mongodb';
import ApiKey from '@/lib/db/models/api-key.model';
// import { NotificationType } from '../models/notification.model';
// import SubscriptionOrder from '../db/models/subscription-order.model';
// import { NotificationType } from '../models/notification.model';
import { updateBankInfo } from './bank.actions';
import { SellerFormData, SettingsFormData } from '../types';
import { Order } from '@/lib/db/models/order.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { SettingsFormDataSchema } from '../types/settings';
// import { uploadToStorage } from '../utils/s3';
// import { ISeller } from '../db/models/seller.model';
import { SellerError } from '../errors/seller-error';
import { NotificationType } from '@/lib/db/models/notification.model';
import validator from 'validator';
import { languages } from 'countries-list';
import { subscriptionUpdateSchema } from '../validator';
// import { emailService } from '@/lib/services/email/mailer';

// Initialize Stripe
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//   apiVersion: '2023-10-16',
// });

// interface ISeller {
//   _id: string;
//   userId: string;
//   bankInfo?: {
//     accountNumber?: string;
//     verified?: boolean;
//   };
//   customSiteUrl?: string;
//   verification?: {
//     status: string;
//   };
//   apiKeys?: any[];
// }




// Initialize PayPal
// const paypalClient = new paypal.core.PayPalHttpClient(
//   new paypal.core.SandboxEnvironment(
//     process.env.PAYPAL_CLIENT_ID || '', 
//     process.env.PAYPAL_CLIENT_SECRET || ''
//   )
// );


// Constants
const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const PERFORMANCE_MARKERS = {
  START: 'seller-metrics-start',
  END: 'seller-metrics-end',
};


// Types and Schemas





export interface SubscriptionUpdateData {
  plan: string;
  pointsToRedeem?: number;
  paymentMethod?: string;
  currency?: string;
  market?: string;
  trialMonthsUsed?: number;
}

// export type SellerFormData = {
//   businessName: string;
//   email: string;
//   phone: string;
//   description?: string;
//   businessType: 'individual' | 'company';
//   vatRegistered: boolean;
//   logo?: File;
//   address: {
//     street: string;
//     city: string;
//     state: string;
//     country: string;
//     postalCode: string;
//   };
//   taxId: string;
//   bankInfo: {
//     accountName: string;
//     accountNumber: string;
//     bankName: string;
//     swiftCode: string;
//   };
//   termsAccepted: boolean;
//   customSiteUrl: string;
// };

// export interface SettingsFormData {
//   businessName?: string;
//   description?: string;
//   phone?: string;
//   address?: {
//     street: string;
//     city: string;
//     state: string;
//     country: string;
//     postalCode: string;
//   };
//   bankInfo?: {
//     accountName: string;
//     accountNumber: string;
//     bankName: string;
//     swiftCode: string;
//   };
//   notifications: {
//     email: boolean;
//     sms: boolean;
//     orderUpdates: boolean;
//     marketingEmails: boolean;
//     pointsNotifications: boolean;
//   };
//   display: {
//     showRating: boolean;
//     showContactInfo: boolean;
//     showMetrics: boolean;
//     showPointsBalance: boolean;
//   };
//   security: {
//     twoFactorAuth: boolean;
//     loginNotifications: boolean;
//   };
//   customSite: {
//     theme: string;
//     primaryColor: string;
//     bannerImage?: string;
//     customSections?: any[];
//   };
//   customSiteUrl?: string;
// }



export type DocumentType = 'businessLicense' | 'taxDocument' | 'identityProof' | 'other';
// export type SubscriptionPlan = 'Trial' | 'Basic' | 'Pro' | 'VIP';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending' | 'suspended';
export interface DocumentUpload {
  file: File;
  type: DocumentType;
  metadata?: Record<string, any>;
}
interface UpdateSellerOptions {
  revalidate?: boolean;
}
// 


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



const updateSellerSchema = z.object({
  businessName: z
    .string()
    .min(2, { message: 'validation business name min' })
    .max(100, { message: 'validation business name max' })
    .regex(/^[\p{L}\p{N}\s.,!?&()-]+$/u, { message: 'validation business name format' })
    .optional(),
  description: z
    .string()
    .min(10, { message: 'validation description min' })
    .max(500, { message: 'validation description max' })
    .regex(/^[\p{L}\p{N}\s.,!?&()-]+$/u, { message: 'validation description format' })
    .optional(),
  taxId: z
    .string()
    .min(5, { message: 'validation tax id min' })
    .regex(/^[0-9A-Z-]*$/, { message: 'validation tax id format' })
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  logo: z.string().url().optional().nullable(),
  address: z
    .object({
      street: z.string().min(1, { message: 'validation address street required' }).optional(),
      city: z.string().min(1, { message: 'validation address city required' }).optional(),
      state: z.string().min(1, { message: 'validation address state required' }).optional(),
      countryCode: z
        .string()
        .min(2, { message: 'validation address country required' })
        .regex(/^[A-Z]{2}$/, { message: 'validation address country code format' })
        .optional(),
      postalCode: z
        .string()
        .min(1, { message: 'validation address postal code required' })
        .regex(/^[0-9A-Z\s-]*$/, { message: 'validation address postal code format' })
        .optional(),
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
          welcomeSeen: z.boolean().optional(),
        })
        .optional(),
      security: z
        .object({
          twoFactorAuth: z.boolean().optional(),
          loginNotifications: z.boolean().optional(),
          ipWhitelist: z
            .array(
              z.string().refine(
                (value) => validator.isIP(value),
                { message: 'Invalid IP address' }
              )
            )
            .optional(),
        })
        .optional(),
      customSite: z
        .object({
          theme: z.string().optional(),
          primaryColor: z
            .string()
            .regex(/^#[0-9A-F]{6}$/i, { message: 'validation invalid hex color' })
            .optional(),
          bannerImage: z
            .string()
            .url({ message: 'validation invalid url' })
            .optional()
            .nullable(),
          customSections: z
            .array(
              z.object({
                title: z.string().min(2, { message: 'validation section title min' }),
                content: z.string().min(10, { message: 'validation section content min' }),
                order: z.number().default(0),
              })
            )
            .optional(),
          domainStatus: z.enum(['active', 'expired', 'pending']).optional(),
          domainRenewalDate: z.date().optional(),
          seo: z
            .object({
              metaTitle: z.string().max(60).optional(),
              metaDescription: z.string().max(160).optional(),
              keywords: z.array(z.string()).optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  bankInfo: z
    .object({
      accountName: z.string().min(1).optional(),
      accountNumber: z.string().min(1).optional(),
      bankName: z.string().min(1).optional(),
      swiftCode: z.string().min(1).optional(),
      routingNumber: z.string().optional(),
    })
    .optional(),
});

export async function updateSeller(
  userId: string,
  data: Partial<z.infer<typeof updateSellerSchema>>,
  logoFile?: File,
  locale: string = 'en'
) {
  const t = await getSafeTranslations(locale, 'api');
  try {
await connectToDatabase();
    const validatedData = updateSellerSchema.parse(data);
    let logoUrl = validatedData.logo;

    if (logoFile) {
      const maxSize = 5 * 1024 * 1024;
      if (logoFile.size > maxSize) {
        throw new SellerError(t('errors.logoSizeExceeds'), 'INVALID_FILE');
      }
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
      if (!allowedTypes.includes(logoFile.type)) {
        throw new SellerError(t('errors.invalidLogoType'), 'INVALID_FILE');
      }
      const buffer = Buffer.from(await logoFile.arrayBuffer());
      const uploadResult = await uploadToStorage(buffer, `sellers/${userId}/logo`, {
        folder: 'sellers',
        resource_type: 'image',
        public_id: `logo-${userId}-${Date.now()}`,
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'svg'],
        maxSize,
        overwrite: true,
      });
      logoUrl = uploadResult.secureUrl;
    }

    const updateData: any = {};
    if (validatedData.businessName) updateData.businessName = validatedData.businessName;
    if (validatedData.description) updateData.description = validatedData.description;
    if (validatedData.taxId) updateData.taxId = validatedData.taxId;
    if (logoUrl !== undefined) updateData.logo = logoUrl;
    if (validatedData.address) updateData.address = validatedData.address;
    if (validatedData.settings) {
      updateData.settings = {};
      if (validatedData.settings.notifications)
        updateData.settings.notifications = validatedData.settings.notifications;
      if (validatedData.settings.display)
        updateData.settings.display = validatedData.settings.display;
      if (validatedData.settings.security)
        updateData.settings.security = validatedData.settings.security;
      if (validatedData.settings.customSite)
        updateData.settings.customSite = validatedData.settings.customSite;
    }
    updateData.updatedAt = new Date();

    const seller = await Seller.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!seller) throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');

    await sendNotification({
      userId,
      type: 'profile updated',
      title: t('messages.profileUpdatedTitle'),
      message: t('messages.profileUpdatedMessage'),
      channels: ['in_app', 'email', 'sms', 'push'],
      data: { sellerId: seller._id },
    });

    return { success: true, seller };
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : t('errors.failedToUpdateSeller');
    const errorCode = error instanceof SellerError ? error.code : 'UNKNOWN';
    logger.error('Update seller error', { userId, error: errorMessage, code: errorCode });
    return { success: false, error: errorMessage, code: errorCode };
  }
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


// Error Class





// =========================================================================
// === HELPER FUNCTIONS ===
// =========================================================================

async function getSafeTranslations(locale: string, namespace: string) {
  try {
    return await getTranslations({ locale, namespace });
  } catch (error) {
    logger.error('Failed to load translations', { error, locale, namespace });
    return (key: string) => key;
  }
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




// =========================================================================
// === API KEY MANAGEMENT ===
// =========================================================================

/**
 * Retrieves all API keys for a seller
 * @param userId - The user ID
 * @param locale - Language locale
 * @returns Success status and API keys data
 */
export async function getSellerApiKeys(userId: string, locale: string = 'en') {
  const t = await getSafeTranslations(locale, 'api.errors');
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
    return { success: true, data: apiKeys };
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : t('failedToGetApiKeys');
    const errorCode = error instanceof SellerError ? error.code : 'UNKNOWN';
    logger.error('Get API keys error', { userId, error: errorMessage, code: errorCode });
    return { success: false, error: errorMessage, code: errorCode };
  }
}


// =========================================================================
// === SELLER MANAGEMENT ===
// =========================================================================

/**
 * Creates a new seller profile
 * @param userId - The user ID
 * @param data - Seller form data
 * @param locale - Language locale
 * @returns Success status and seller data
 */
export async function createSeller(
  userId: string,
  data: SellerFormData,
  locale: string = 'en'
): Promise<{ success: boolean; data?: ISeller; message?: string; error?: string; code?: string }> {
  const t = await getSafeTranslations(locale, 'api');
  try {
await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (!mongoose.isValidObjectId(userId)) {
        throw new SellerError(t('errors.invalidData'), 'INVALID_ID');
      }
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new SellerError(t('errors.userNotFound'), 'USER_NOT_FOUND');
      }
      const existingSeller = await Seller.findOne({
        $or: [{ email: data.email }, { userId }, { customSiteUrl: data.customSiteUrl }],
      }).session(session);
      if (existingSeller) {
        logger.warn('Duplicate seller found', { email: data.email, userId });
        throw new SellerError(t('messages.sellerExists'), 'DUPLICATE_SELLER');
      }
      if (!data.termsAccepted) {
        throw new SellerError(t('errors.termsNotAccepted'), 'TERMS_NOT_ACCEPTED');
      }
      let logoUrl: string | undefined;
      if (data.logo && data.logo.size > 0) {
        const buffer = Buffer.from(await data.logo.arrayBuffer());
        const uploadResult = await uploadToStorage(buffer, `sellers/${userId}/logo`, {
          folder: 'sellers',
          resource_type: 'image',
          allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
          public_id: `${userId}-${Date.now()}`,
          overwrite: true,
        });
        logoUrl = uploadResult.secureUrl;
      }
      const customSiteUrl = data.customSiteUrl || `seller-${userId}`;
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
            vatRegistered: data.vatRegistered || false,
            taxId: data.taxId,
            logo: data.logo || null,
            address: {
              street: data.address.street,
              city: data.address.city,
              state: data.address.state,
              countryCode: data.address.countryCode, // تعديل من country إلى countryCode
              postalCode: data.address.postalCode,
            },
            subscription: {
              plan: data.is_trial ? 'Trial' : 'Basic',
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
              documents: [],
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
            freeTrialActive: data.is_trial,
            freeTrialEndDate: trialEndDate,
            trialMonthsUsed: 0,
            customSiteUrl,
            isActive: true,
          },
        ],
        { session }
      );
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { role: 'SELLER', businessProfile: seller[0]._id },
        { new: true, session }
      );
      if (!updatedUser) {
        throw new SellerError(t('errors.updateUserRoleFailed'), 'USER_UPDATE_FAILED');
      }
      await session.commitTransaction();
      revalidatePath('/[locale]/seller/dashboard', 'page');
      revalidatePath('/[locale]/account', 'page');
      await Promise.all([
        sendNotification({
          userId,
          type: 'welcome',
          title: t('notifications.sellerRegistered.title'),
          message: t('notifications.sellerRegistered.message'),
          channels: ['email', 'in_app'],
        }),
        sendNotification({
          userId,
          type: 'points earned',
          title: t('messages.bonusPointsTitle'),
          message: t('messages.bonusPointsMessage', { points: 50 }),
          channels: ['email', 'in_app'],
        }),
        sendNotification({
          userId,
          type: 'trial reminder',
          title: t('messages.trialActiveTitle'),
          message: t('messages.trialActiveMessage', { trialDays: 5 }),
          channels: ['email', 'in_app'],
        }),
      ]);
      logger.info('Seller created successfully', { userId, sellerId: seller[0]._id });
      return { success: true, data: seller[0], message: t('messages.success') };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : t('errors.serverError');
    const errorCode = error instanceof SellerError ? error.code : 'UNKNOWN';
    logger.error('Create seller error', { userId, error: errorMessage, code: errorCode });
    return { success: false, error: errorMessage, code: errorCode };
  }
}


/**
 * Updates seller profile
 * @param userId - The user ID
 * @param data - Partial seller data
 * @param logoFile - Optional logo file
 * @param locale - Language locale
 * @returns Success status and updated seller data
 */


// =========================================================================
// === SETTINGS MANAGEMENT ===
// =========================================================================

/**
 * Updates seller settings
 * @param userId - The user ID
 * @param data - Settings data
 * @param bannerFile - Optional banner file
 * @param locale - Language locale
 * @returns Success status and settings data
 */

export async function updateSellerSettings(
  userId: string,
  data: Partial<SettingsFormData>,
  files?: FormData,
  locale: string = 'en'
) {
  const t = await getTranslations({ locale, namespace: 'api' });
  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id || session.user.id !== userId || session.user.role !== 'SELLER') {
      throw new SellerError(t('errors.unauthorized'), 'UNAUTHORIZED');
    }

    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    // Validate data with Zod
    const validatedData = SettingsFormDataSchema.partial().parse(data);

    // Update business information
    seller.businessName = validatedData.businessName || seller.businessName;
    seller.description = validatedData.description || seller.description;
    seller.email = validatedData.email || seller.email;
    seller.phone = validatedData.phone || seller.phone;
    seller.customSiteUrl = validatedData.customSiteUrl || seller.customSiteUrl;

    // Update address
    if (validatedData.address) {
      if (!validatedData.address.countryCode?.match(/^[A-Z]{2}$/)) {
        throw new SellerError(t('errors.invalidCountryCode'), 'INVALID_COUNTRY_CODE');
      }
      seller.address = validatedData.address;
    }

    // Update bank info if mgpay is active
    if (validatedData.bankInfo) {
      const hasMgpay = seller.paymentGateways.some(
        (gateway: any) => gateway.providerName === 'mgpay' && gateway.isActive
      );
      if (hasMgpay) {
        seller.bankInfo = {
          accountName: validatedData.bankInfo.accountName,
          accountNumber: encrypt(validatedData.bankInfo.accountNumber),
          bankName: validatedData.bankInfo.bankName,
          swiftCode: encrypt(validatedData.bankInfo.swiftCode),
          verified: validatedData.bankInfo.verified || false,
        };
      } else {
        throw new SellerError(t('errors.bankInfoNotAllowed'), 'BANK_INFO_NOT_ALLOWED');
      }
    }

    // Update shipping options
    if (validatedData.shippingOptions) {
      seller.shippingOptions = validatedData.shippingOptions.map((option) => ({
        id: option.id || new mongoose.Types.ObjectId().toString(),
        name: option.name,
        daysToDeliver: option.daysToDeliver,
        shippingPrice: option.shippingPrice,
        freeShippingMinPrice: option.freeShippingMinPrice,
        supportedCountries: option.supportedCountries,
        isActive: option.isActive,
      }));
    }

    // Update discount offers
    if (validatedData.discountOffers) {
      seller.discountOffers = validatedData.discountOffers.map((offer) => ({
        id: offer.id || new mongoose.Types.ObjectId().toString(),
        code: offer.code,
        description: offer.description,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        minPurchase: offer.minPurchase,
        maxDiscount: offer.maxDiscount,
        validFrom: offer.validFrom,
        validUntil: offer.validUntil,
        maxUses: offer.maxUses,
        usedCount: offer.usedCount,
        isActive: offer.isActive,
        applicableProducts: offer.applicableProducts,
        applicableCategories: offer.applicableCategories,
      }));
    }

    // Update payment gateways
    if (validatedData.paymentGateways) {
      seller.paymentGateways = validatedData.paymentGateways.map((gateway) => ({
        providerName: gateway.providerName,
        accountDetails: new Map(
          Object.entries(gateway.accountDetails || {}).map(([key, value]) => [
            key,
            encrypt(String(value)),
          ])
        ),
        verified: gateway.verified,
        isDefault: gateway.isDefault,
        isInternal: gateway.isInternal,
        sandbox: gateway.sandbox,
      }));
    }

    // Update settings
    if (validatedData.notifications) {
      seller.settings.notifications = validatedData.notifications;
    }
    if (validatedData.display) {
      seller.settings.display = {
        showRating: validatedData.display.showRating,
        showContactInfo: validatedData.display.showContactInfo,
        showMetrics: validatedData.display.showMetrics,
        showPointsBalance: validatedData.display.showPointsBalance,
        welcomeSeen: validatedData.display.welcomeSeen ?? false,
      };
    }
    if (validatedData.security) {
      seller.settings.security = validatedData.security;
    }
    if (validatedData.customSite) {
      seller.settings.customSite = {
        theme: validatedData.customSite.theme,
        primaryColor: validatedData.customSite.primaryColor,
        bannerImage: validatedData.customSite.bannerImage,
        customSections: validatedData.customSite.customSections,
        domainStatus: validatedData.customSite.domainStatus,
        domainRenewalDate: validatedData.customSite.domainRenewalDate,
        seo: validatedData.customSite.seo ?? {
          metaTitle: '',
          metaDescription: '',
          keywords: [],
        },
      };
    }

    // Handle file uploads
    if (files) {
      if (files.get('logo')) {
        const logoFile = files.get('logo') as File;
        const uploadResult = await uploadToStorage(logoFile, `sellers/${seller._id}/logo`, {
          contentType: logoFile.type,
          maxSize: 5 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        });
        seller.logo = uploadResult.secureUrl;
      }
      if (files.get('bannerImage')) {
        const bannerFile = files.get('bannerImage') as File;
        const uploadResult = await uploadToStorage(bannerFile, `sellers/${seller._id}/banner`, {
          contentType: bannerFile.type,
          maxSize: 5 * 1024 * 1024,
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        });
        seller.settings.customSite.bannerImage = uploadResult.secureUrl;
      }
    }

    await seller.save();
    await sendNotification({
      userId: session.user.id,
      type: 'profile_updated',
      title: t('messages.profileUpdatedTitle'),
      message: t('messages.profileUpdatedMessage'),
      channels: ['in_app', 'email'],
      data: { sellerId: seller._id },
    });

    return { success: true, data: seller };
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : t('errors.serverError');
    const errorCode = error instanceof SellerError ? error.code : 'UNKNOWN';
    console.error('Update seller settings error', {
      userId,
      error: errorMessage,
      code: errorCode,
    });
    return { success: false, error: errorMessage, code: errorCode };
  }
}


// =========================================================================
// === SUBSCRIPTION MANAGEMENT ===
// =========================================================================

/**
 * Updates seller subscription
 * @param userId - The user ID
 * @param data - Subscription data
 * @param locale - Language locale
 * @returns Success status
 */

// Schema for updateSellerSubscription input

interface ExchangeRateResponse {
  rates: Record<string, number>;
}

async function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
  try {
    const response = await axios.get<ExchangeRateResponse>(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
    const rate = response.data.rates[toCurrency];
    if (!rate) throw new Error(`Exchange rate not found for ${toCurrency}`);
    return round2(amount * rate);
  } catch (error) {
    logger.error('Currency conversion failed', { error: String(error) });
    return amount;
  }
}

// Subscription Management
export async function updateSellerSubscription(
  userId: string,
  data: SubscriptionUpdateData,
  locale: string = 'en'
): Promise<{ success: boolean; data?: ISeller; error?: string; code?: string }> {
  const t = await getSafeTranslations(locale, 'subscriptions');
  try {
    // Validate input data
    const validatedData = subscriptionUpdateSchema.parse(data);
    const targetCurrency = validatedData.currency || 'USD';

    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();

    let convertedAmount = 0;
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      try {
        await session.withTransaction(async () => {
          const seller = await Seller.findOne({ userId }, {}, { session });
          if (!seller) {
            throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
          }

          const user = await User.findById(userId).session(session);
          if (!user) {
            throw new SellerError(t('errors.userNotFound'), 'USER_NOT_FOUND');
          }

          const plans = await getSubscriptionPlans();
          const plan = plans.find((p) => p.id.toLowerCase() === validatedData.plan.toLowerCase());
          if (!plan) {
            throw new SellerError(t('errors.invalidPlan'), 'INVALID_PLAN');
          }

          // Convert currency
          convertedAmount = await convertCurrency(plan.price, 'USD', targetCurrency);

          // Check if subscription is already active
          const currentDate = new Date();
          if (
            seller.subscription.status === 'active' &&
            seller.subscription.plan.toLowerCase() === plan.id.toLowerCase() &&
            seller.subscription.endDate &&
            seller.subscription.endDate > currentDate
          ) {
            throw new SellerError(t('errors.activeSubscription'), 'ACTIVE_SUBSCRIPTION');
          }

          // Check if trial is allowed
          if (plan.isTrial && seller.freeTrial) {
            throw new SellerError(t('errors.trialNotAllowed'), 'TRIAL_NOT_ALLOWED');
          }

          // Handle payment integration if not using points
          let paymentIntegration: IIntegration | null = null;
          if (validatedData.paymentMethod && validatedData.pointsToRedeem === 0) {
            paymentIntegration = await Integration.findOne({
              providerName: validatedData.paymentMethod,
              type: 'payment',
              isActive: true,
            }).session(session);
            if (!paymentIntegration && validatedData.paymentMethod !== 'mgpay') {
              throw new SellerError(t('errors.paymentMethodNotFound'), 'PAYMENT_METHOD_NOT_FOUND');
            }
            // Check bankInfo for mgpay
            if (validatedData.paymentMethod === 'mgpay' && !seller.bankInfo?.verified) {
              throw new SellerError(t('errors.bankNotVerified'), 'BANK_NOT_VERIFIED');
            }
            // Process payment
            const paymentResult = await processPayment(
              seller,
              paymentIntegration || { providerName: 'mgpay', type: 'payment', isActive: true, status: 'connected', settings: {} },
              convertedAmount,
              targetCurrency,
              plan.id
            );
            if (!paymentResult.success) {
              throw new SellerError(t('errors.paymentFailed'), 'PAYMENT_FAILED');
            }
          }

          // Handle points redemption
          if (validatedData.pointsToRedeem && validatedData.pointsToRedeem > 0) {
            if (!plan.features.pointsRedeemable) {
              throw new SellerError(t('errors.pointsNotSupported'), 'POINTS_NOT_SUPPORTED');
            }
            if (seller.pointsBalance < validatedData.pointsToRedeem) {
              throw new SellerError(t('errors.insufficientPoints'), 'INSUFFICIENT_POINTS');
            }
            seller.pointsBalance -= validatedData.pointsToRedeem;
            seller.pointsTransactions.push({
              amount: validatedData.pointsToRedeem,
              type: 'debit',
              description: `Redeemed points for ${plan.name} subscription in ${validatedData.market || 'unknown'}`,
              createdAt: new Date(),
            });
          }

          // Update subscription
          const startDate = new Date();
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + (plan.isTrial ? plan.trialDuration! : 1));

          seller.subscription = {
            plan: plan.name as 'Trial' | 'Basic' | 'Pro' | 'VIP',
            planId: validatedData.plan,
            price: plan.price || 0,
            trialMonthsUsed: validatedData.trialMonthsUsed ?? 0,
            pointsCost: plan.pointsCost || 0,
            startDate,
            endDate,
            status: 'active',
            features: {
              productsLimit: plan.features.productsLimit,
              analytics: plan.features.analyticsAccess || false,
              commission: plan.features.commission,
              prioritySupport: plan.features.prioritySupport,
              instantPayouts: plan.features.instantPayouts,
              customSectionsLimit: plan.features.customSectionsLimit || 0,
              domainSupport: plan.features.domainSupport || false,
              domainRenewal: plan.features.domainRenewal || false,
              analyticsAccess: plan.features.analyticsAccess || false,
              abTesting: plan.features.abTesting || false,
              pointsRedeemable: plan.features.pointsRedeemable || false,
              dynamicPaymentGateways: plan.features.dynamicPaymentGateways || false,
              maxApiKeys: plan.features.maxApiKeys || 1,
            },
            pointsRedeemed: validatedData.pointsToRedeem || 0,
            paymentMethod: validatedData.paymentMethod,
            currency: targetCurrency,
            market: validatedData.market,
          };

          if (plan.isTrial) {
            seller.freeTrial = true;
            seller.freeTrialEndDate = endDate;
            seller.trialMonthsUsed = plan.trialDuration!;
          }

          // Create subscription order
          if (validatedData.pointsToRedeem > 0 || paymentIntegration || validatedData.paymentMethod === 'mgpay') {
            await SubscriptionOrder.create(
              [
                {
                  userId,
                  sellerId: seller._id,
                  planId: plan.id,
                  amount: convertedAmount,
                  currency: targetCurrency,
                  paymentMethod: validatedData.pointsToRedeem > 0 ? 'points' : validatedData.paymentMethod,
                  isPaid: true,
                  paidAt: new Date(),
                  market: validatedData.market,
                },
              ],
              { session }
            );
          }

          await seller.save({ session });
        });

        break;
      } catch (error) {
        attempt++;
        if (attempt === maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    // Send subscription confirmation email via API Route
    if (validatedData.pointsToRedeem > 0 || validatedData.paymentMethod) {
      const seller = await Seller.findOne({ userId });
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }
      const user = await User.findById(userId);
      if (!user) {
        throw new SellerError(t('errors.userNotFound'), 'USER_NOT_FOUND');
      }

      await WebhookDispatcher.dispatch(userId, 'subscription_updated', {
        userId,
        plan: validatedData.plan,
        pointsRedeemed: validatedData.pointsToRedeem,
        paymentMethod: validatedData.paymentMethod,
        currency: targetCurrency,
        market: validatedData.market,
      });

      // Use API Route to send email
      const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          to: seller.email,
          name: user.name || seller.businessName,
          plan: validatedData.plan,
          amount: convertedAmount,
          currency: targetCurrency,
          email: seller.email,
        }),
      });

      if (!emailResponse.ok) {
        logger.error('Failed to send subscription confirmation email', {
          userId,
          sellerId: seller._id,
          error: await emailResponse.text(),
        });
        // Don't fail the transaction if email fails
      }
    }

    await session.commitTransaction();

    revalidatePath(`/${locale}/account/subscriptions`, 'page');
    revalidatePath(`/${locale}/seller/dashboard`, 'page');

    logger.info('Subscription updated', {
      userId,
      plan: validatedData.plan,
      pointsRedeemed: validatedData.pointsToRedeem,
      paymentMethod: validatedData.paymentMethod,
      currency: targetCurrency,
      convertedAmount,
    });

    return { success: true, data: await Seller.findOne({ userId }) };
  } catch (error) {
    await session.abortTransaction();
    const errorMessage = error instanceof SellerError ? error.message : t('errors.failedToUpdateSubscription');
    const errorCode = error instanceof SellerError ? error.code : 'UNKNOWN';
    logger.error('Update subscription error', {
      userId,
      error: errorMessage,
      code: errorCode,
      input: data,
    });
    return { success: false, error: errorMessage, code: errorCode };
  } finally {
    session.endSession();
  }
}
// دالة مساعدة لمعالجة الدفع عبر تكامل ديناميكي
export async function processPayment(
  seller: ISeller,
  integration: IIntegration,
  amount: number,
  currency: string,
  planId: string
): Promise<{ success: boolean; transactionId?: string; error?: string }> {
  try {
    const { authType, endpoints, clientId, clientSecret } = integration.settings;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (authType === 'Bearer') {
      headers['Authorization'] = `Bearer ${clientId}`;
    } else if (authType === 'Basic') {
      const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    } else if (authType === 'APIKey') {
      if (!clientId) {
        throw new SellerError('Client ID is required for APIKey authentication', 'MISSING_CLIENT_ID');
      }
      headers['X-API-Key'] = clientId;
    } else if (authType === 'OAuth') {
      const sellerIntegration = seller.integrations.find((i: SellerIntegration) => i.providerName === integration.providerName);
      if (!sellerIntegration?.accessToken) {
        throw new SellerError('OAuth token not found', 'OAUTH_TOKEN_NOT_FOUND');
      }
      headers['Authorization'] = `Bearer ${await decrypt(sellerIntegration.accessToken)}`;
    }

    const paymentEndpoint = endpoints?.get('capturePayment');
    if (!paymentEndpoint) {
      throw new SellerError('Payment endpoint not found', 'MISSING_ENDPOINT');
    }

    const response = await fetch(paymentEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amount: amount * (integration.settings.amountMultiplier || 1),
        currency,
        sellerId: seller._id,
        planId,
        email: seller.email,
      }),
    });

    const result = await response.json();
    return { success: result.success, transactionId: result.transactionId || undefined };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}


export async function syncPaymentGateways(sellerId: string) {
  const t = await getTranslations({ locale: 'en', namespace: 'api' });
  try {
    const integrations = await SellerIntegration.find({ sellerId, type: 'payment', status: 'connected', isActive: true });
    
    // هنا قمنا باستخدام Promise.all مع map لتعامل مع العمليات غير المتزامنة
    const paymentGateways = await Promise.all(integrations.map(async (int: any) => {
      const verified = int.providerName === 'mgpay' 
        ? (await Seller.findById(sellerId))?.bankInfo?.verified ?? false
        : int.status === 'connected';

      return {
        providerName: int.providerName,
        accountDetails: int.credentials ? Object.fromEntries(int.credentials.map((c: any) => [c.key, encrypt(c.value)])) : {},
        verified,
        isDefault: false, // Logic to determine default gateway
        isInternal: int.providerName === 'mgpay',
        sandbox: int.sandbox || false,
      };
    }));

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    seller.paymentGateways = paymentGateways;
    await seller.save();
    return paymentGateways;
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : t('errors.failedToSyncGateways');
    console.error('Sync payment gateways error', { sellerId, error: errorMessage });
    throw error;
  }
}



export async function addPaymentGateway(
  userId: string,
  providerName: string,
  accountDetails: Record<string, any>,
  isInternal: boolean = false,
  sandbox: boolean = false,
  locale: string = 'en'
) {
  const t = await getTranslations({ locale, namespace: 'api' });
  try {
    await connectToDatabase();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      if (isInternal && providerName === 'mgpay' && !seller.bankInfo?.verified) {
        throw new SellerError(t('errors.bankNotVerified'), 'BANK_NOT_VERIFIED');
      }

      if (seller.subscription.status !== 'active') {
        throw new SellerError(t('errors.inactiveSubscription'), 'INACTIVE_SUBSCRIPTION');
      }

      if (!seller.subscription.features.dynamicPaymentGateways && providerName !== 'mgpay') {
        throw new SellerError(t('errors.dynamicGatewaysNotAllowed'), 'FEATURE_NOT_AVAILABLE');
      }

      const integration = await Integration.findOne({ providerName, isActive: true }).session(session);
      if (!integration && providerName !== 'mgpay') {
        throw new SellerError(t('errors.integrationNotFound'), 'INTEGRATION_NOT_FOUND');
      }

      // التحقق من بيانات البوابات الخارجية
      if (providerName === 'paypal' && (!accountDetails.clientId || !accountDetails.clientSecret)) {
        throw new SellerError(t('errors.invalidPaypalCredentials'), 'INVALID_CREDENTIALS');
      }
      if (providerName === 'stripe' && !accountDetails.apiKey) {
        throw new SellerError(t('errors.invalidStripeCredentials'), 'INVALID_CREDENTIALS');
      }

      const encryptedDetails = new Map<string, string>();
      Object.entries(accountDetails).forEach(([key, value]) => {
        encryptedDetails.set(key, encrypt(String(value)));
      });

      const existingGateway = seller.paymentGateways.find((g: any) => g.providerName === providerName);
      if (existingGateway) {
        throw new SellerError(t('errors.gatewayExists'), 'GATEWAY_EXISTS');
      }

      seller.paymentGateways.push({
        providerName,
        accountDetails: encryptedDetails,
        verified: providerName === 'mgpay' ? (seller.bankInfo?.verified ?? false) : false,
        isDefault: seller.paymentGateways.length === 0,
        isInternal,
        sandbox,
      });

      if (!isInternal && integration) {
        const sellerIntegration = await SellerIntegration.create(
          {
            sellerId: seller._id,
            integrationId: integration._id,
            providerName,
            type: 'payment',
            accountDetails: encryptedDetails,
            isActive: true,
            sandbox,
          },
          { session }
        );

        seller.integrationIds.push(sellerIntegration._id);
      }

      await seller.save({ session });
      await session.commitTransaction();

      await sendNotification({
        userId,
        type: 'payment_gateway_added' as any,
        title: t('messages.paymentGatewayAddedTitle'),
        message: t('messages.paymentGatewayAddedMessage', { provider: providerName }),
        channels: ['in_app', 'email'],
        data: { sellerId: seller._id, providerName },
      });

      return { success: true, message: t('messages.paymentGatewayAdded') };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : t('errors.failedToAddGateway');
    const errorCode = error instanceof SellerError ? error.code : 'UNKNOWN';
    console.error('Add payment gateway error', { userId, providerName, error: errorMessage, code: errorCode });
    return { success: false, error: errorMessage, code: errorCode };
  }
}

export async function getAvailableIntegrations(
  userId: string,
  locale: string = 'en'
): Promise<{ success: boolean; data?: IIntegration[]; error?: string; code?: string }> {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
await connectToDatabase();
    if (!isValidObjectId(userId)) {
      throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
    }

    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    // جلب التكاملات النشطة
    const integrations = await Integration.find({ isActive: true }).lean();

    // إضافة حالة التكامل (متصل/غير متصل) بناءً على إعدادات البائع
const enrichedIntegrations = integrations.map((integration) => {
  const sellerIntegration = Object.values(seller.integrations).find(
    (i) => i.providerName === integration.providerName
  );
  return {
    ...integration,
    credentials: new Map(Object.entries(integration.credentials || {})), // تحويل إلى Map
    connected: !!sellerIntegration,
    status: sellerIntegration?.isActive ? 'connected' : 'disconnected',
  };
});

    return {
      success: true,
      data: enrichedIntegrations,
    };
  } catch (error) {
    console.error('Get available integrations error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToFetchIntegrations'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}



async function fetchWarehouseInventory(provider: string, sku: string) {
  // Placeholder for actual warehouse API integration
  return {
    quantity: Math.floor(Math.random() * 100), // Simulated response
    lastUpdated: new Date(),
  };
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
          total: { $sum: '$totalPrice' },
          count: { $sum: 1 },
          average: { $avg: '$totalPrice' },
          previous: {
            $sum: {
              $cond: [{ $lt: ['$createdAt', startDate] }, '$totalPrice', 0],
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




// calculate




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
    const totalEarned = seller.pointsTransactions.reduce((sum: any, tx: { type: string; amount: any; }) => {
      return tx.type === 'earn' ? sum + tx.amount : sum;
    }, 0);
    const totalRedeemed = seller.pointsTransactions.reduce((sum: any, tx: { type: string; amount: any; }) => {
      return tx.type === 'redeem' ? sum + tx.amount : sum;
    }, 0);

    return {
      balance: seller.pointsBalance,
      totalEarned,
      totalRedeemed,
      recentTransactions: transactions.map((tx: { amount: any; type: any; description: any; createdAt: any; }) => ({
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


export async function updateSellerById(
  userId: string,
  updateData: Partial<ISeller>,
  options: UpdateSellerOptions = {},
  locale: string
): Promise<{ success: boolean; data?: ISeller; error?: string }> {
  try {
await connectToDatabase();
    const t = await getTranslations({ locale, namespace: 'api' });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const seller = await Seller.findOneAndUpdate(
        { userId },
        { $set: updateData },
        { new: true, session, runValidators: true }
      );

      if (!seller) {
        await session.abortTransaction();
        logger.warn('Seller not found', { userId });
        return { success: false, error: t('errors.sellerNotFound') };
      }

      await session.commitTransaction();

      if (options.revalidate) {
        revalidatePath(`/${locale}/admin/sellers`);
        revalidatePath(`/${locale}/admin/sellers/[sellerId]`);
      }

      logger.info('Seller updated successfully', { userId, updatedFields: Object.keys(updateData) });
      return { success: true, data: seller };
    } catch (error) {
      await session.abortTransaction();
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update seller', { userId, error: errorMessage });
      return { success: false, error: errorMessage };
    } finally {
      session.endSession();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Database connection error', { error: errorMessage });
    return { success: false, error: errorMessage };
  }
}

export async function GET() {
  try {
    const {
      site: { url },
    } = await getSetting()
    const baseUrl = url || 'https://hager-zon.vercel.app'
    const currentDate = new Date().toISOString()

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  <url>
    <loc>${baseUrl}/blog</loc>
    <news:news>
      <news:publication>
        <news:name>MGZon E-commerce</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${currentDate}</news:publication_date>
      <news:title>Latest Updates and News</news:title>
    </news:news>
  </url>
</urlset>`

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=59',
      },
    })
  } catch (error) {
    console.error('Error generating news sitemap:', error)
    return new NextResponse('Error generating sitemap', { status: 500 })
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
    throw new SellerError('Failed to get seller earnings', 'CALCULATION_ERROR');
  }
}


export async function calculateSellerProfit(sellerId: string, startDate: Date, endDate: Date, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
await connectToDatabase();
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    const earnings = await getSellerEarnings(sellerId, startDate, endDate);
    const commissionRate = seller.subscription.features.commission / 100;
    const netProfit = round2(earnings * (1 - commissionRate));
    const platformFee = round2(earnings * commissionRate);

    return {
      success: true,
      data: {
        totalEarnings: earnings,
        netProfit,
        platformFee,
      },
    };
  } catch (error) {
    console.error('Calculate seller profit error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToCalculateProfit'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function syncWarehouseInventory(sellerId: string, productId: string, provider: string, locale: string = 'en') {
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
      if (!isValidObjectId(sellerId) || !isValidObjectId(productId)) {
        throw new SellerError(t('errors.invalidData'), 'INVALID_DATA');
      }

      const seller = await Seller.findById(sellerId).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      const product = await Product.findById(productId).session(session);
      if (!product || product.sellerId.toString() !== seller._id.toString()) {
        throw new SellerError(t('errors.productNotFound'), 'PRODUCT_NOT_FOUND');
      }

      // Simulate warehouse API call (replace with actual API integration)
      const warehouseResponse = await fetchWarehouseInventory(provider, product.warehouse.sku);
      product.warehouse.availableQuantity = warehouseResponse.quantity;
      product.warehouse.lastSync = new Date();
      product.countInStock = warehouseResponse.quantity;
      product.inventoryStatus = warehouseResponse.quantity > product.warehouse.reorderPoint ? 'IN_STOCK' : 'LOW_STOCK';

      await product.save({ session });
      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/products', 'page');

      await sendNotification({
        userId: seller.userId,
        type: 'inventory updated',
        title: t('messages.inventoryUpdatedTitle'),
        message: t('messages.inventoryUpdatedMessage', { productName: product.name, quantity: warehouseResponse.quantity }),
        data: { productId, sellerId: seller._id },
      });

      return {
        success: true,
        data: {
          productId,
          quantity: warehouseResponse.quantity,
          lastSync: product.warehouse.lastSync,
        },
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Sync warehouse inventory error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToSyncInventory'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}




export async function uploadToStorageHelper(file: File, folder: string): Promise<string> {
  try {
    const fileName = `${folder}/${Date.now()}-${file.name}`;
    const url = await uploadToStorage(file, fileName);
    return url;
  } catch (error) {
    console.error('Upload to storage error:', error);
    throw new SellerError('Failed to upload file', 'UPLOAD_ERROR');
  }
}

export async function manageThirdPartyTokens(
  sellerId: string,
  tokenData: {
    provider: string;
    token: string;
    refreshToken?: string;
    expiresAt?: Date;
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
      if (!isValidObjectId(sellerId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findById(sellerId).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }

      // جلب التكامل من قاعدة البيانات
      const integration = await Integration.findOne({
        providerName: tokenData.provider,
        isActive: true,
      }).session(session);
      if (!integration) {
        throw new SellerError(t('errors.integrationNotFound'), 'INTEGRATION_NOT_FOUND');
      }

      // تحديث بيانات التكامل
      seller.integrations = seller.integrations || [];
      const existingIntegration = seller.integrations.find((i: any) => i.provider === tokenData.provider);
      if (existingIntegration) {
        existingIntegration.token = await encrypt(tokenData.token);
        existingIntegration.refreshToken = tokenData.refreshToken ? await encrypt(tokenData.refreshToken) : undefined;
        existingIntegration.expiresAt = tokenData.expiresAt;
      } else {
        seller.integrations.push({
          provider: tokenData.provider,
          token: await encrypt(tokenData.token),
          refreshToken: tokenData.refreshToken ? await encrypt(tokenData.refreshToken) : undefined,
          expiresAt: tokenData.expiresAt,
        });
      }

      // إذا كان التكامل من نوع 'payment' ويتطلب التحقق من الحساب البنكي
      if (integration.type === 'payment' && integration.settings.requiresBankVerification) {
        if (!seller.bankInfo?.accountNumber) {
          throw new SellerError(t('errors.bankInfoRequired'), 'BANK_INFO_REQUIRED');
        }
        // هنا يمكن إجراء التحقق من الحساب البنكي بناءً على إعدادات التكامل
        const bankVerificationResult = await verifyBankAccount(seller.bankInfo, integration);
        if (!bankVerificationResult.success) {
          throw new SellerError(t('errors.bankVerificationFailed'), 'BANK_VERIFICATION_FAILED');
        }
        seller.bankInfo.verified = true;
      }

      await seller.save({ session });
      await session.commitTransaction();

      revalidatePath('/[locale]/seller/dashboard/integrations', 'page');

      await sendNotification({
        userId: seller.userId,
        type: 'integration updated',
        title: t('messages.integrationUpdatedTitle'),
        message: t('messages.integrationUpdatedMessage', { provider: tokenData.provider }),
        data: { sellerId: seller._id, provider: tokenData.provider },
      });

      return {
        success: true,
        data: tokenData,
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Manage third-party tokens error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToManageTokens'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

// دالة مساعدة للتحقق من الحساب البنكي بناءً على التكامل
async function verifyBankAccount(
  bankInfo: { accountNumber: string; accountName: string; swiftCode: string },
  integration: IIntegration
): Promise<{ success: boolean; error?: string }> {
  try {
    const { authType, endpoints, clientId, clientSecret } = integration.settings;

    // التحقق من وجود endpoints و endpoint الخاص بالتحقق (verify)
    if (!endpoints || !endpoints.has('verify')) {
      throw new Error('Verification endpoint not configured');
    }

    const verifyEndpoint = endpoints.get('verify');
    if (!verifyEndpoint) {
      throw new Error('Verification endpoint URL is missing');
    }

    if (authType === 'OAuth') {
      const response = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clientId}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountNumber: await decrypt(bankInfo.accountNumber),
          accountName: bankInfo.accountName,
          swiftCode: bankInfo.swiftCode,
        }),
      });

      const result = await response.json();
      return { success: result.success };
    }

    // دعم أنواع أخرى من التحقق (مثل Basic أو APIKey)
    return { success: true }; // محاكاة نجاح التحقق
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}


// Existing functions (already defined, included for completeness)

// Existing functions (already defined, included for completeness)
export async function getSellerByUserId(
  userId: string,
  locale: string = 'en'
): Promise<{ success: boolean; data?: ISeller; error?: string; code?: string }> {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const seller = await Seller.findOne({ userId }).lean();
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    const now = new Date();
    const sellerDoc = await Seller.findOne({ userId });
    if (!sellerDoc) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    if (
      sellerDoc.subscription?.endDate &&
      new Date(sellerDoc.subscription.endDate) < now &&
      sellerDoc.subscription.status !== 'expired'
    ) {
      await Seller.updateOne(
        { userId },
        {
          $set: {
            'subscription.status': 'expired',
            freeTrial: false,
            updatedAt: now,
          },
        }
      );
      sellerDoc.subscription.status = 'expired';
      sellerDoc.freeTrial = false;
    }

    // Remove sensitive data
    const sanitizedSeller = {
      ...sellerDoc.toObject(),
      bankInfo: sellerDoc.bankInfo
        ? { ...sellerDoc.bankInfo, accountNumber: '', swiftCode: '', routingNumber: '' }
        : undefined,
      paymentGateways: sellerDoc.paymentGateways.map((gateway: any) => ({
        ...gateway,
        accountDetails: new Map(),
      })),
      integrations: Object.fromEntries(
        Object.entries(sellerDoc.integrations || {}).map(([key, integration]: [string, any]) => [
          key,
          { ...integration, accessToken: '', refreshToken: '' },
        ])
      ),
    };

    logger.info('Seller fetched successfully', { userId, sellerId: seller._id });
    return {
      success: true,
      data: sanitizedSeller as ISeller,
    };
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : t('errors.failedToFetchSeller');
    const errorCode = error instanceof SellerError ? error.code : 'unknown';
    logger.error('Get seller by userId error', { userId, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
      code: errorCode,
    };
  }
}

export async function getFullSellerProfile(userId: string, locale: string = 'en') {
  const t = await getTranslations({ locale, namespace: 'api' });
  const session = await auth();

  if (!session?.user?.id || session.user.id !== userId) {
    throw new SellerError(t('errors.unauthenticated'), 'UNAUTHENTICATED');
  }

  try {
await connectToDatabase();
    const user = await User.findById(userId).lean();
    const seller = await Seller.findOne({ userId })
      .populate('products orders')
      .lean();

    if (!user || !seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    return {
      success: true,
      data: { ...user, sellerProfile: seller },
    };
  } catch (error) {
    logger.error('Get full seller profile error', { error });
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToFetchSeller'),
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
        type: 'points earned',
        title: t('messages.pointsEarnedTitle'),
        message: t('messages.pointsEarnedMessage', { points: amount, description }),
        data: { points: amount, sellerId: seller._id },
        channels: ['in_app', 'email', 'sms'],
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

export async function getSellerById(
  sellerId: string,
  locale: string = 'en'
): Promise<{ success: boolean; data?: ISeller; error?: string; code?: string }> {
  const t = await getTranslations({ locale, namespace: 'api' });

  try {
await connectToDatabase();
    const seller = await Seller.findOne({
      $or: [
        { _id: isValidObjectId(sellerId) ? sellerId : null },
        { businessName: sellerId },
      ],
    })
      .select('-bankInfo.accountNumber')
      .lean();

    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    logger.info('Seller fetched by ID', { sellerId });
    return {
      success: true,
      data: seller as ISeller,
    };
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : t('errors.failedToGetSeller');
    const errorCode = error instanceof SellerError ? error.code : 'unknown';
    logger.error('Get seller by ID error', { sellerId, error: errorMessage });
    return {
      success: false,
      error: errorMessage,
      code: errorCode,
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


export async function checkSubscriptionStatus(userId: string, locale: string = 'en') {
  let t;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
    t = (key: string) => key;
  }

  try {
    await connectToDatabase();
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    // التحقق من endDate قبل استخدامه
    if (!seller.subscription.endDate) {
      // لو endDate undefined، اعتبر الاشتراك مستمر (غير منتهي)
      // يمكن تضيف هنا logic إضافي، زي إرسال إشعار أو تحديث الـ status
      return {
        success: true,
        data: {
          plan: seller.subscription.plan,
          status: seller.subscription.status, // ربما 'active' أو 'ongoing'
          endDate: null, // أو 'Indefinite' كـ string
        },
      };
    }

    const currentDate = new Date();
    const endDate = new Date(seller.subscription.endDate); // دلوقتي آمن لأننا تأكدنا إنه موجود

    if (currentDate > endDate) {
      seller.subscription.status = 'expired';
      await seller.save();
    }

    return {
      success: true,
      data: {
        plan: seller.subscription.plan,
        status: seller.subscription.status,
        endDate: seller.subscription.endDate,
      },
    };
  } catch (error) {
    console.error('Check subscription status error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToCheckSubscription'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

interface PointsTransaction {
  type: 'credit' | 'debit';
  amount: number;
}

interface SaleHistory {
  date: Date;
  amount: number;
}

export async function getSellerMetrics(userId: string, locale: string = 'en') {
  const t = await getTranslations({ locale, namespace: 'api' });
  try {
await connectToDatabase();
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    return {
      points: {
        balance: seller.pointsBalance,
        earned: seller.pointsHistory
          .filter((t: PointsTransaction) => t.type === 'credit')
          .reduce((sum: number, t: PointsTransaction) => sum + t.amount, 0),
        redeemed: seller.pointsHistory
          .filter((t: PointsTransaction) => t.type === 'debit')
          .reduce((sum: number, t: PointsTransaction) => sum + Math.abs(t.amount), 0),
      },
      subscription: {
        plan: seller.subscription.plan,
        status: seller.subscription.status,
        endDate: seller.subscription.endDate,
      },
      revenue: {
        yearly: seller.metrics.totalRevenue,
        monthly: seller.metrics.totalSalesHistory
          ?.filter((sale: SaleHistory) => new Date(sale.date).getMonth() === new Date().getMonth())
          .reduce((sum: number, sale: SaleHistory) => sum + sale.amount, 0) || 0,
      },
      orders: {
        total: seller.metrics.ordersCount,
        avgOrderValue: seller.metrics.ordersCount
          ? seller.metrics.totalRevenue / seller.metrics.ordersCount
          : 0,
      },
      products: {
        total: seller.metrics.products.total,
      },
      performance: {
        rating: seller.metrics.rating,
      },
    };
  } catch (error) {
    console.error('Get seller metrics error:', error);
    throw new SellerError(t('errors.failedToFetchMetrics'), 'UNKNOWN');
  }
}



export const getCachedSellerMetrics = cache(async (userId: string, locale: string = 'en') => {
  const t = await getSafeTranslations(locale, 'api');
  try {
await connectToDatabase();
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    const pointsEarned = seller.pointsHistory
      .filter((t: PointsTransaction) => t.type === 'credit')
      .reduce((sum: number, t: PointsTransaction) => sum + t.amount, 0);

    const pointsRedeemed = seller.pointsHistory
      .filter((t: PointsTransaction) => t.type === 'debit')
      .reduce((sum: number, t: PointsTransaction) => sum + Math.abs(t.amount), 0);

    const monthlyRevenue = seller.metrics.totalSalesHistory
      ?.filter((sale: SaleHistory) => new Date(sale.date).getMonth() === new Date().getMonth())
      .reduce((sum: number, sale: SaleHistory) => sum + sale.amount, 0) || 0;

    const avgOrderValue = seller.metrics.ordersCount
      ? seller.metrics.totalRevenue / seller.metrics.ordersCount
      : 0;

    logger.info('Cached seller metrics fetched', { userId, sellerId: seller._id });
    return {
      points: {
        balance: seller.pointsBalance,
        earned: pointsEarned,
        redeemed: pointsRedeemed,
      },
      subscription: {
        plan: seller.subscription.plan,
        status: seller.subscription.status,
        endDate: seller.subscription.endDate,
      },
      revenue: {
        yearly: seller.metrics.totalRevenue,
        monthly: monthlyRevenue,
      },
      orders: {
        total: seller.metrics.ordersCount,
        avgOrderValue,
      },
      products: {
        total: seller.metrics.products.total,
      },
      performance: {
        rating: seller.metrics.rating,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : t('errors.failedToFetchMetrics');
    const errorCode = error instanceof SellerError ? error.code : 'UNKNOWN';
    logger.error('Get cached seller metrics error', { userId, error: errorMessage, code: errorCode });
    throw new SellerError(errorMessage, errorCode);
  }
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
        type: 'api_key rotated',
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
        type: 'api_key deactivated',
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

export async function updateSellerMetrics({
  sellerId,
  updates,
  locale = 'en',
}: {
  sellerId: string;
  updates: {
    productsCount?: number;
    lastProductCreated?: Date;
    action?: string;
  };
  locale?: string;
}): Promise<{ success: boolean; data?: ISeller; error?: string; code?: string }> {
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
      if (!mongoose.Types.ObjectId.isValid(sellerId)) {
        throw new SellerError(t('invalidSellerData'), 'INVALID_ID');
      }

      const seller = await Seller.findById(sellerId).session(session);
      if (!seller) {
        throw new SellerError(t('sellerNotFound'), 'NOT_FOUND');
      }

      const updateData: any = {
        updatedAt: new Date(),
      };

      if (typeof updates.productsCount === 'number') {
        updateData['metrics.productsCount'] = Math.max(0, (seller.metrics.productsCount || 0) + updates.productsCount);
      }

      if (updates.lastProductCreated) {
        updateData['metrics.lastProductCreated'] = updates.lastProductCreated;
      }

      if (updates.action) {
        if (updates.action === 'product_created') {
          updateData['metrics.products.total'] = (seller.metrics.products?.total || 0) + 1;
          updateData['metrics.products.active'] = (seller.metrics.products?.active || 0) + 1;
        } else if (updates.action === 'product_deleted') {
          updateData['metrics.products.total'] = Math.max(0, (seller.metrics.products?.total || 0) - 1);
          updateData['metrics.products.active'] = Math.max(0, (seller.metrics.products?.active || 0) - 1);
        } else if (updates.action === 'product_out_of_stock') {
          updateData['metrics.products.active'] = Math.max(0, (seller.metrics.products?.active || 0) - 1);
          updateData['metrics.products.outOfStock'] = (seller.metrics.products?.outOfStock || 0) + 1;
        } else if (updates.action === 'product_back_in_stock') {
          updateData['metrics.products.active'] = (seller.metrics.products?.active || 0) + 1;
          updateData['metrics.products.outOfStock'] = Math.max(0, (seller.metrics.products?.outOfStock || 0) - 1);
        }
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



export async function distributeEarnings(sellerId: string, period: 'daily' | 'weekly' | 'monthly', locale: string = 'en') {
  let t = (key: string) => key;
  try {
    t = await getTranslations({ locale, namespace: 'api' });
  } catch (error) {
    console.error('Failed to load translations:', error);
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

      // التحقق من وجود تكامل دفع نشط
      const paymentIntegration = await Integration.findOne({
        providerName: { $in: Object.values(seller.integrations).map((i: any) => i.provider) },
        
        type: 'payment',
        isActive: true,
      }).session(session);
      if (!paymentIntegration) {
        throw new SellerError(t('errors.noActivePaymentIntegration'), 'NO_PAYMENT_INTEGRATION');
      }

      if (paymentIntegration.settings.requiresBankVerification && !seller.bankInfo?.verified) {
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
      const netEarnings = round2(earnings * (1 - commissionRate));
      const platformFee = round2(earnings * commissionRate);

      // تنفيذ الدفع عبر التكامل
      const payoutResult = await processPayment(
        seller,
        paymentIntegration,
        netEarnings,
        'USD', // يمكن تعديل العملة بناءً على إعدادات التكامل
        `Payout for ${period} earnings`
      );
      if (!payoutResult.success) {
        throw new SellerError(t('errors.payoutFailed'), 'PAYOUT_FAILED');
      }

      seller.metrics.totalRevenue += netEarnings;
      seller.pointsHistory.push({
        amount: netEarnings,
        type: 'credit',
        reason: `Earnings distribution for ${period}`,
        createdAt: new Date(),
      });

      await seller.save({ session });

      await Seller.updateOne(
        { _id: process.env.PLATFORM_SELLER_ID },
        {
          $inc: { 'metrics.totalRevenue': platformFee },
          $push: {
            pointsHistory: {
              amount: platformFee,
              type: 'credit',
              reason: `Platform commission for ${period} from seller ${sellerId}`,
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
        type: 'earnings distributed',
        title: t('messages.earningsDistributedTitle'),
        message: `${t('messages.earningsDistributedMessage')} Amount: ${netEarnings}, Period: ${period}`,
        data: {
          sellerId: seller._id,
          amount: netEarnings,
          period,
          payoutId: payoutResult.transactionId || 'unknown',
        },
        channels: ['in_app', 'email', 'sms'],
      });

      return {
        success: true,
        data: {
          earnings: netEarnings,
          commission: platformFee,
          payoutId: payoutResult.transactionId || 'unknown',
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


// export async function someSellerAction(userId: string, productId: string, action: string, locale: string = 'en') {
//   function t(key: string, p0: { productName: any; }) {
//     return key;
//   }
//   try {
//     t = await getTranslations({ locale, namespace: 'api' });
//   } catch (error) {
//     console.error('Failed to load translations:', error);
//   }

//   try {
// await connectToDatabase();
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//       if (!isValidObjectId(userId) || !isValidObjectId(productId)) {
//         throw new SellerError(t('errors.invalidData'), 'INVALID_DATA');
//       }

//       const seller = await Seller.findOne({ userId }).session(session);
//       if (!seller) {
//         throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
//       }

//       const product = await Product.findById(productId).session(session);
//       if (!product || product.sellerId.toString() !== seller._id.toString()) {
//         throw new SellerError(t('errors.productNotFound'), 'PRODUCT_NOT_FOUND');
//       }

//       let notificationType: NotificationType;
//       let notificationMessage: string;
//       let updateData: any = {};

//       switch (action) {
//         case 'publish':
//           if (product.status === 'active') {
//             throw new SellerError('errors.productAlreadyPublished', 'ALREADY_PUBLISHED');
//           }
//           updateData.status = 'active';
//           notificationType = 'product_published';
//           notificationMessage = t('messages.productPublishedMessage', { productName: product.name });
//           break;

//         case 'unpublish':
//           if (product.status === 'draft') {
//             throw new SellerError('errors.productAlreadyUnpublished', 'ALREADY_UNPUBLISHED');
//           }
//           updateData.status = 'draft';
//           notificationType = 'product_unpublished';
//           notificationMessage = t('messages.productUnpublishedMessage', { productName: product.name });
//           break;

//         case 'delete':
//           await Product.findByIdAndDelete(productId, { session });
//           await updateSellerMetrics(seller._id.toString(), {
//             productsCount: (seller.metrics.productsCount || 0) - 1,
//             action: 'product_deleted',
//           }, locale);
//           notificationType = 'product_deleted';
//           notificationMessage = t('messages.productDeletedMessage', { productName: product.name });
//           break;

//         default:
//           throw new SellerError(t('errors.invalidAction'), 'INVALID_ACTION');
//       }

//       if (action !== 'delete') {
//         await Product.findByIdAndUpdate(productId, { $set: updateData }, { session });
//       }

//       await session.commitTransaction();

//       revalidatePath('/[locale]/seller/dashboard/products', 'page');
//       revalidatePath(`/[locale]/${seller.customSiteUrl}`, 'page');

//       await sendNotification({
//         userId,
//         type: notificationType,
//         title: t(`messages.${notificationType}Title`),
//         message: notificationMessage,
//         data: { productId, sellerId: seller._id },
//         channels: ['in_app', 'email', 'sms'],
//       });

//       return {
//         success: true,
//         message: notificationMessage,
//       };
//     } catch (error) {
//       await session.abortTransaction();
//       throw error;
//     } finally {
//       session.endSession();
//     }
//   } catch (error) {
//     console.error('Seller action error:', error);
//     return {
//       success: false,
//       error: error instanceof SellerError ? error.message : t('errors.failedToPerformAction'),
//       code: error instanceof SellerError ? error.code : 'UNKNOWN',
//     };
//   }
// }


// New Functions for Product Management



export async function getSellerByCustomSiteUrl(customSiteUrl: string, locale: string = 'en') {
  const t = await getTranslations({ locale, namespace: 'api' });
  try {
await connectToDatabase();

    // تنظيف customSiteUrl
    const normalizedUrl = customSiteUrl.startsWith('/') ? customSiteUrl : `/${customSiteUrl}`;
    console.log(`Querying seller with customSiteUrl: ${normalizedUrl}`);

    const seller = await Seller.findOne({ customSiteUrl: normalizedUrl })
      .select('-bankInfo.accountNumber')
      .lean();

    if (!seller) {
      await customLogger.error('Seller not found for customSiteUrl', { customSiteUrl });
      return { success: false, message: t('errors.sellerNotFound') };
    }

  return { success: !!seller, data: seller };
  } catch (error) {
    console.error('Get seller by customSiteUrl error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.failedToFetchSeller'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN',
    };
  }
}

export async function checkAndUpdateSubscriptionStatus(userId: string, locale: string = 'en') {
  const t = await getTranslations({ locale, namespace: 'api' });
  try {
await connectToDatabase();
    const seller = await Seller.findOne({ userId });
    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
    }

    const now = new Date();
if (seller.subscription.endDate && seller.subscription.endDate < now && seller.subscription.status !== 'expired') {
  const endDate = new Date(seller.subscription.endDate);

      seller.subscription.status = 'inactive';
      seller.freeTrialActive = false;
      seller.updatedAt = now;

      await seller.save();

      await sendNotification({
        userId,
        type: 'subscription expired',
        title: t('notifications.subscriptionExpired.title'),
        message: t('notifications.subscriptionExpired.message'),
        channels: ['email', 'in_app'],
      });
    }

    return {
      success: true,
      data: seller.subscription,
    };
  } catch (error) {
    console.error('Check subscription status error:', error);
    return {
      success: false,
      error: t('errors.failedToCheckSubscription'),
      code: 'INTERNAL_SERVER_ERROR',
    };
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
        seller.logo && deleteFromStorage(seller.logo),
        seller.settings.customSite?.bannerImage && deleteFromStorage(seller.settings.customSite.bannerImage),
        ...Array.from(seller.verification.documents.values()).map((doc: any) =>
          doc.url && deleteFromStorage(doc.url)
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
        type: 'account suspended',
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



export async function decryptAccountNumber(seller: ISeller): Promise<ISeller> {
  const bankInfo = seller.bankInfo;
  if (bankInfo?.accountNumber && typeof bankInfo.accountNumber === 'string' && bankInfo.accountNumber.includes(':')) {
    try {
      bankInfo.accountNumber = await decrypt(bankInfo.accountNumber);
    } catch (error) {
      console.error(`Failed to decrypt account number for seller ${seller._id}:`, error);
      throw new SellerError('Failed to decrypt bank account number', 'DECRYPTION_ERROR');
    }
  } else {
    logger.warn(`No encrypted account number found for seller ${seller._id}`);
    if (bankInfo) {
      bankInfo.accountNumber = '';
      bankInfo.verified = false;
    }
  }
  return seller;
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
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new SellerError(t('errors.invalidSellerData'), 'INVALID_ID');
      }
      const seller = await Seller.findOne({ userId }).session(session);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'NOT_FOUND');
      }
      if (!seller.apiKeys) {
        seller.apiKeys = [];
      }

      // تحقق من صحة الأذونات
      const validPermissions = [
        'products:read', 'products:write', 'orders:read', 'orders:write',
        'customers:read', 'customers:write', 'inventory:read', 'inventory:write',
        'analytics:read'
      ];
      const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        throw new SellerError(t('errors.invalidPermissions'), 'INVALID_PERMISSIONS');
      }

      const plans = await getSubscriptionPlans();
      const subscriptionPlan = plans.find((p: SubscriptionPlan) => p.name === seller.subscription.plan);
      const maxApiKeys = subscriptionPlan?.features.maxApiKeys || 1;
      const existingKeyCount = await ApiKey.countDocuments({ sellerId: seller._id });

      if (existingKeyCount >= maxApiKeys) {
        throw new SellerError(t('errors.apiKeyLimitExceeded', { limit: maxApiKeys }), 'API_KEY_LIMIT');
      }

      const serverSession = await auth();
      const currentUser = serverSession?.user?.id || 'system';

      const apiKey = await ApiKeyService.createApiKey({
        name,
        permissions,
        expiresAt,
        sellerId: seller._id
      });

      seller.apiKeys.push(apiKey._id);
      await seller.save({ session });

      await sendNotification({
        userId,
        type: 'api_key_created' as NotificationType,
        title: t('messages.apiKeyCreatedTitle'),
        message: t('messages.apiKeyCreatedMessage', { name }),
        data: { sellerId: seller._id, apiKeyId: apiKey._id }
      });

      await session.commitTransaction();

      return {
        success: true,
        data: apiKey
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
      error: error instanceof SellerError ? error.message : t('errors.failedToCreateApiKey'),
      code: error instanceof SellerError ? error.code : 'UNKNOWN'
    };
  }
}

function deleteFromStorage(logo: string): any {
  throw new Error('Function not implemented.');
}
