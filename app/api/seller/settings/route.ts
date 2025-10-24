import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Seller, { ISeller, SellerIntegration } from '@/lib/db/models/seller.model';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { SettingsFormDataSchema } from '@/lib/types/settings';
import { assignDomain } from '@/lib/domainManager';
import { uploadToStorage } from '@/lib/utils/cloudinary';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { v4 as uuidv4 } from 'uuid';
import { updateSellerSettings, getSellerByUserId, updateSellerSubscription } from '@/lib/actions/seller.actions';

// Extended schema to align with settings.ts and seller.model.ts
const ExtendedSettingsFormDataSchema = SettingsFormDataSchema.extend({
  taxSettings: z.record(
    z.object({
      countryCode: z.string().regex(/^[A-Z]{2}$/, 'Invalid country code'),
      taxType: z.string().default('none'),
      taxRate: z.number().min(0).max(100, 'Tax rate must be between 0 and 100'),
      taxService: z.string().default('none'),
    })
  ).optional(),
  integrations: z.array(
    z.object({
      providerName: z.string().min(1, 'Provider name is required'),
      type: z.enum([
        'payment', 'warehouse', 'dropshipping', 'marketplace', 'shipping', 'marketing',
        'accounting', 'crm', 'analytics', 'automation', 'communication', 'education',
        'security', 'advertising', 'tax', 'other'
      ]),
      token: z.string().optional(),
      accessToken: z.string().optional(),
      refreshToken: z.string().optional(),
      expiresAt: z.date().optional(),
      metadata: z.record(z.any()).optional(),
      isActive: z.boolean().default(true),
      connectedAt: z.date().optional(),
      lastUpdatedAt: z.date().optional(),
      sandbox: z.boolean().default(false),
    })
  ).optional(),
  verification: z.object({
    documents: z.array(
      z.object({
        url: z.string().url('Invalid document URL').optional(),
        type: z.enum(['id', 'business_license', 'tax_document', 'other']),
        status: z.enum(['pending', 'verified', 'rejected']).default('pending'),
        uploadedAt: z.date().optional(),
        metadata: z.record(z.any()).optional(),
      })
    ).optional(),
    status: z.enum(['pending', 'verified', 'rejected']).default('pending'),
    submittedAt: z.date().optional(),
    lastUpdatedAt: z.date().optional(),
  }).optional(),
  checkoutSettings: z.object({
    customCheckoutEnabled: z.boolean().default(false),
    checkoutPageUrl: z.string().url('Invalid checkout page URL').optional(),
  }).optional(),
  defaultPaymentGateway: z.string().optional(), // Ensure defaultPaymentGateway is supported
});

// Subscription update schema
const subscriptionUpdateSchema = z.object({
  plan: z.enum(['Trial', 'Basic', 'Pro', 'VIP'], { message: 'Invalid subscription plan' }),
  pointsToRedeem: z.number().min(0, { message: 'Points to redeem cannot be negative' }).optional(),
  paymentMethod: z.string().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Invalid currency code').optional(),
  market: z.string().optional(),
  trialMonthsUsed: z.number().min(0).optional(),
  isTrial: z.boolean().optional(),
  paymentGatewayId: z.string().optional(),
});

// Send log to /api/log
async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, meta, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.error('Failed to send log:', err);
  }
}

// GET: Fetch seller settings
export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('seller');
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      await sendLog('error', t('Unauthorized'), { requestId, userId: session?.user?.id });
      return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 401 });
    }

    await connectToDatabase();
    const seller = await getSellerByUserId(session.user.id).lean();
    if (!seller) {
      await sendLog('error', t('Seller not found'), { requestId, userId: session.user.id });
      return NextResponse.json({ success: false, message: t('Seller not found') }, { status: 404 });
    }

    // Remove sensitive data from response
    const sellerData = {
      ...seller,
      bankInfo: seller.bankInfo ? { ...seller.bankInfo, accountNumber: '', swiftCode: '', routingNumber: '' } : undefined,
      paymentGateways: seller.paymentGateways.map((gateway: any) => ({
        ...gateway,
        accountDetails: new Map(), // Empty sensitive account details
      })),
      integrations: Object.fromEntries(
        Object.entries(seller.integrations || {}).map(([key, integration]: [string, any]) => [
          key,
          { ...integration, accessToken: '', refreshToken: '' },
        ])
      ),
    };

    await sendLog('info', t('Seller settings fetched'), { requestId, userId: session.user.id });
    return NextResponse.json({ success: true, data: sellerData });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : t('Server error');
    await sendLog('error', t('Failed to fetch seller settings'), { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}

// PATCH: Update seller settings
export async function PATCH(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('seller');
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      await sendLog('error', t('Unauthorized'), { requestId });
      return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 401 });
    }

    const formData = await req.formData();
    const settingsJson = formData.get('settings');
    const logoFile = formData.get('logo') as File | null;
    const bannerFile = formData.get('bannerImage') as File | null;
    const documentFiles = formData.getAll('documents') as File[];

    if (!settingsJson) {
      await sendLog('error', t('Invalid settings data'), { requestId });
      return NextResponse.json({ success: false, message: t('Invalid settings data') }, { status: 400 });
    }

    // Parse and decrypt sensitive data
    const settings = JSON.parse(settingsJson as string);
    if (settings.bankInfo?.accountNumber) {
      try {
        settings.bankInfo.accountNumber = decrypt(settings.bankInfo.accountNumber);
        settings.bankInfo.swiftCode = settings.bankInfo.swiftCode ? decrypt(settings.bankInfo.swiftCode) : undefined;
        settings.bankInfo.routingNumber = settings.bankInfo.routingNumber ? decrypt(settings.bankInfo.routingNumber) : undefined;
      } catch (error) {
        await sendLog('error', t('Failed to decrypt bank info'), { requestId, error });
        return NextResponse.json({ success: false, message: t('Failed to decrypt bank info') }, { status: 400 });
      }
    }

    // Validate settings data
    const validatedData = ExtendedSettingsFormDataSchema.parse(settings);

    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id }).lean();
    if (!seller) {
      await sendLog('error', t('Seller not found'), { requestId, userId: session.user.id });
      return NextResponse.json({ success: false, message: t('Seller not found') }, { status: 404 });
    }

    // Validate bankInfo if mgpay is active
    if (validatedData.bankInfo) {
      const hasMgpay = seller.paymentGateways.some(
        (gateway: any) => gateway.providerName === 'mgpay' && gateway.isActive
      );
      if (!hasMgpay) {
        await sendLog('error', t('bankInfo requires mgpay'), { requestId });
        return NextResponse.json({ success: false, message: t('bankInfo requires mgpay') }, { status: 400 });
      }
    }

    // Validate paymentGateways against integrations
    if (validatedData.paymentGateways) {
      const activePaymentIntegrations = Object.values(seller.integrations || {})
        .filter((integration: any) => integration.type === 'payment' && integration.isActive)
        .map((integration: any) => integration.providerName);

      const invalidGateways = validatedData.paymentGateways.filter(
        (gateway) => !activePaymentIntegrations.includes(gateway.providerName)
      );
      if (invalidGateways.length > 0) {
        await sendLog('error', t('Invalid payment gateways'), {
          requestId,
          invalidGateways: invalidGateways.map((g) => g.providerName),
        });
        return NextResponse.json(
          { success: false, message: t('Invalid payment gateways: must be active in integrations') },
          { status: 400 }
        );
      }

      // Validate defaultPaymentGateway
      if (
        validatedData.defaultPaymentGateway &&
        !validatedData.paymentGateways.some(
          (gateway) => gateway.providerName === validatedData.defaultPaymentGateway && gateway.isActive
        )
      ) {
        await sendLog('error', t('Invalid default payment gateway'), { requestId });
        return NextResponse.json(
          { success: false, message: t('Default payment gateway must be active') },
          { status: 400 }
        );
      }
    }

    // Handle file uploads (logo, banner, verification documents)
    let logoUrl = seller.logo;
    let bannerUrl = seller.settings?.customSite?.bannerImage;
    let documents = seller.verification?.documents || [];

    if (logoFile) {
      try {
        const { secureUrl } = await uploadToStorage(logoFile, `seller-logos/${session.user.id}`, {
          resource_type: 'image',
          folder: 'seller-logos',
          public_id: `logo-${session.user.id}-${Date.now()}`,
          allowedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
          maxSize: 5 * 1024 * 1024,
        });
        logoUrl = secureUrl;
      } catch (uploadError) {
        await sendLog('error', t('Failed to upload logo'), { requestId, error: (uploadError as Error).message });
        return NextResponse.json({ success: false, message: t('Failed to upload logo') }, { status: 400 });
      }
    }

    if (bannerFile) {
      try {
        const { secureUrl } = await uploadToStorage(bannerFile, `seller-banners/${session.user.id}`, {
          resource_type: 'image',
          folder: 'seller-banners',
          public_id: `banner-${session.user.id}-${Date.now()}`,
          allowedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
          maxSize: 5 * 1024 * 1024,
        });
        bannerUrl = secureUrl;
      } catch (uploadError) {
        await sendLog('error', t('Failed to upload banner'), { requestId, error: (uploadError as Error).message });
        return NextResponse.json({ success: false, message: t('Failed to upload banner') }, { status: 400 });
      }
    }

    if (documentFiles && documentFiles.length > 0) {
      try {
        documents = await Promise.all(
          documentFiles.map(async (file, index) => {
            const documentType = validatedData.verification?.documents?.[index]?.type || 'other';
            const { secureUrl } = await uploadToStorage(file, `seller-verification/${session.user.id}`, {
              resource_type: 'auto',
              folder: 'seller-verification',
              public_id: `document-${documentType}-${session.user.id}-${Date.now()}`,
              allowedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'],
              maxSize: 10 * 1024 * 1024,
            });
            return {
              url: secureUrl,
              type: documentType,
              status: validatedData.verification?.documents?.[index]?.status || 'pending',
              uploadedAt: new Date(),
              metadata: validatedData.verification?.documents?.[index]?.metadata || {},
            };
          })
        );
      } catch (uploadError) {
        await sendLog('error', t('Failed to upload verification documents'), { requestId, error: (uploadError as Error).message });
        return NextResponse.json({ success: false, message: t('Failed to upload verification documents') }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: Partial<ISeller> = {
      businessName: validatedData.businessName || seller.businessName,
      description: validatedData.description,
      email: validatedData.email,
      phone: validatedData.phone,
      address: validatedData.address || seller.address,
      bankInfo: validatedData.bankInfo ? {
        ...validatedData.bankInfo,
        accountNumber: validatedData.bankInfo.accountNumber ? encrypt(validatedData.bankInfo.accountNumber) : undefined,
        swiftCode: validatedData.bankInfo.swiftCode ? encrypt(validatedData.bankInfo.swiftCode) : undefined,
        routingNumber: validatedData.bankInfo.routingNumber ? encrypt(validatedData.bankInfo.routingNumber) : undefined,
      } : undefined,
      settings: {
        notifications: validatedData.notifications,
        display: validatedData.display,
        security: validatedData.security,
        customSite: {
          theme: validatedData.customSite.theme,
          primaryColor: validatedData.customSite.primaryColor,
          bannerImage: bannerUrl,
          customSections: validatedData.customSite.customSections,
          seo: validatedData.customSite.seo,
          domainStatus: validatedData.customSite.domainStatus || seller.settings?.customSite?.domainStatus || 'pending',
          domainRenewalDate: validatedData.customSite.domainRenewalDate,
        },
        language: validatedData.settings?.language || seller.settings?.language || 'en',
        abTesting: validatedData.settings?.abTesting || seller.settings?.abTesting || { enabled: false, experiments: [] },
      },
      shippingOptions: validatedData.shippingOptions || seller.shippingOptions,
      discountOffers: validatedData.discountOffers || seller.discountOffers,
      paymentGateways: validatedData.paymentGateways?.map((gateway) => ({
        ...gateway,
        accountDetails: gateway.accountDetails ? new Map(Object.entries(gateway.accountDetails)) : new Map(),
      })) || seller.paymentGateways,
      defaultPaymentGateway: validatedData.defaultPaymentGateway || seller.defaultPaymentGateway,
      logo: logoUrl,
      taxSettings: validatedData.taxSettings || seller.taxSettings,
      integrations: validatedData.integrations?.reduce((acc, integration) => {
        acc[integration.providerName] = {
          ...integration,
          accessToken: integration.accessToken ? encrypt(integration.accessToken) : undefined,
          refreshToken: integration.refreshToken ? encrypt(integration.refreshToken) : undefined,
        };
        return acc;
      }, {} as Record<string, SellerIntegration>) || seller.integrations,
      verification: {
        status: validatedData.verification?.status || seller.verification?.status || 'pending',
        documents: documents.length > 0 ? documents : seller.verification?.documents,
        submittedAt: validatedData.verification?.submittedAt || seller.verification?.submittedAt || new Date(),
        lastUpdatedAt: validatedData.verification?.lastUpdatedAt || new Date(),
      },
      checkoutSettings: validatedData.checkoutSettings || seller.checkoutSettings,
      customSiteUrl: validatedData.customSiteUrl || seller.customSiteUrl,
    };

    // Update seller settings
    await updateSellerSettings(session.user.id, updateData);

    await sendLog('info', t('Seller settings updated'), { requestId, userId: session.user.id, updatedFields: Object.keys(updateData) });
    return NextResponse.json({ success: true, message: t('Settings updated successfully') });
  } catch (error) {
    const errorMessage = error instanceof z.ZodError
      ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      : error instanceof Error
      ? error.message
      : t('Server error');
    await sendLog('error', t('Failed to update seller settings'), { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}

// POST: Update subscription
export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('subscriptions');
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== 'SELLER') {
      await sendLog('error', t('Unauthorized'), { requestId });
      return NextResponse.json({ success: false, message: t('Unauthorized') }, { status: 401 });
    }

    const data = await req.json();
    const validatedData = subscriptionUpdateSchema.parse(data);

    await connectToDatabase();
    const seller = await getSellerByUserId(session.user.id).lean();
    if (!seller) {
      await sendLog('error', t('Seller not found'), { requestId, userId: session.user.id });
      return NextResponse.json({ success: false, message: t('Seller not found') }, { status: 404 });
    }

    const updatedSeller = await updateSellerSubscription(session.user.id, {
      ...validatedData,
      status: validatedData.isTrial ? 'pending' : 'active',
      startDate: new Date(),
      features: seller.subscription.features, // Preserve existing features
    });
    const domain = await assignDomain(session.user.id, seller.businessName, validatedData.plan);

    await sendLog('info', t('Subscription updated'), { requestId, userId: session.user.id, plan: validatedData.plan });
    return NextResponse.json({
      success: true,
      message: t('Subscription updated'),
      data: { plan: validatedData.plan, domain, subscription: updatedSeller.subscription },
    });
  } catch (error) {
    const errorMessage = error instanceof z.ZodError
      ? error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      : error instanceof Error
      ? error.message
      : t('Server error');
    await sendLog('error', t('Failed to update subscription'), { requestId, error: errorMessage });
    return NextResponse.json({ success: false, message: errorMessage }, { status: 500 });
  }
}