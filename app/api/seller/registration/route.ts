import { connectToDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Seller from '@/lib/db/models/seller.model';
import User from '@/lib/db/models/user.model';
import mongoose from 'mongoose';
import { z } from 'zod';
import { uploadToStorage } from '@/lib/utils/cloudinary';
import { getTranslations, getLocale } from 'next-intl/server';
import { sendNotification } from '@/lib/actions/notification.actions';
import { logger } from '@/lib/api/services/logging';
import { prometheusMetrics } from '@/lib/api/services/metrics';

// مخطط Zod للتحقق من بيانات تسجيل البائع
const sellerRegistrationSchema = z
  .object({
    businessName: z
      .string()
      .min(2, { message: 'validation.businessName.min' })
      .max(100, { message: 'validation.businessName.max' })
      .regex(/^[a-zA-Z0-9\s.,!?&()-]+$/u, { message: 'validation.businessName.format' }),
    email: z
      .string()
      .email({ message: 'validation.email.invalid' })
      .min(5, { message: 'validation.email.min' })
      .max(100, { message: 'validation.email.max' }),
    phone: z
      .string()
      .min(10, { message: 'validation.phone.min' })
      .max(20, { message: 'validation.phone.max' })
      .regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/, { message: 'validation.phone.format' }),
    description: z
      .string()
      .min(50, { message: 'validation.description.min' })
      .max(500, { message: 'validation.description.max' })
      .regex(/^[\p{L}\p{N}\s.,!?&()\n-]+$/u, { message: 'validation.description.format' }),
    businessType: z.enum(['individual', 'company'], {
      required_error: 'validation.businessType.required',
    }),
    vatRegistered: z.boolean().optional().default(false),
    taxId: z
      .string()
      .optional()
      .transform((val) => (val === '' ? undefined : val))
      .refine(
        (val) => !val || (val.length >= 5 && /^[0-9A-Z-]*$/.test(val)),
        { message: 'validation.taxId.min' }
      ),
    logo: z.string().url().optional().nullable(),
    address: z.object({
      street: z.string().min(1, { message: 'validation.address.street.required' }),
      city: z.string().min(1, { message: 'validation.address.city.required' }),
      state: z.string().min(1, { message: 'validation.address.state.required' }),
      countryCode: z.string().min(2, { message: 'validation.address.country.required' }).regex(/^[A-Z]{2}$/, {
        message: 'validation.address.country.format',
      }),
      postalCode: z
        .string()
        .min(1, { message: 'validation.address.postalCode.required' })
        .regex(/^[0-9A-Z\s-]*$/, { message: 'validation.address.postalCode.format' }),
    }),
    termsAccepted: z
      .boolean()
      .refine((val) => val === true, { message: 'validation.terms.required' }),
    is_trial: z.boolean().default(true),
  })
  .refine(
    (data) => data.businessType !== 'company' || (data.taxId && data.taxId.length > 0),
    { message: 'validation.taxId.required', path: ['taxId'] }
  );

type SellerRegistrationData = z.infer<typeof sellerRegistrationSchema>;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seller Registration' });

  try {
    // التحقق من المصادقة
    const userSession = await auth();
    if (!userSession?.user?.id) {
      await prometheusMetrics.recordRequest('POST', '/api/seller/registration', false, Date.now() - startTime);
      await prometheusMetrics.recordSellerRegistration('failed');
      logger.warn('Unauthorized access attempt', { route: '/api/seller/registration' });
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    // تحليل بيانات النموذج
    const formData = await request.formData();
    let data: SellerRegistrationData;

    try {
      const jsonData = formData.get('data');
      if (!jsonData || typeof jsonData !== 'string') {
        throw new Error(t('errors.invalidFormData'));
      }

      const parsedData = JSON.parse(jsonData);
      logger.debug('Parsed form data', { parsedData });

      // التحقق من البيانات باستخدام Zod
      data = sellerRegistrationSchema.parse(parsedData);
      logger.debug('Validated data', { businessType: data.businessType });

      // التحقق من وجود ملف logo في FormData
      const logoFile = formData.get('logo');
      if (logoFile instanceof File) {
        try {
          const { secureUrl } = await uploadToStorage(logoFile, `seller-logos/${userSession.user.id}`, {
            resource_type: 'image',
            folder: 'seller-logos',
            public_id: `logo-${userSession.user.id}-${Date.now()}`,
            allowedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
            maxSize: 5 * 1024 * 1024,
          });
          console.log('Uploaded logo URL:', secureUrl);
          data.logo = secureUrl;
          logger.debug('Logo uploaded to Cloudinary', { secureUrl });
        } catch (uploadError) {
          logger.error('Logo upload error', { error: (uploadError as Error).message });
          throw new Error(t('errors.logoUploadFailed'));
        }
      }
    } catch (error) {
      await prometheusMetrics.recordRequest('POST', '/api/seller/registration', false, Date.now() - startTime);
      await prometheusMetrics.recordSellerRegistration('failed');
      if (error instanceof z.ZodError) {
        logger.warn('Validation error', { errors: error.errors });
        return NextResponse.json(
          {
            success: false,
            message: t('errors.invalidData'),
            errors: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: t(err.message, { count: err.path.includes('email') ? 5 : err.path.includes('phone') ? 10 : 2 }),
            })),
          },
          { status: 400 }
        );
      }
      const errorMessage = error instanceof Error ? error.message : t('errors.parseFailed');
      logger.error('Parse error', { error: errorMessage });
      return NextResponse.json(
        { success: false, message: t('errors.parseFailed'), error: errorMessage },
        { status: 400 }
      );
    }

    // الاتصال بقاعدة البيانات وبدء جلسة المعاملة
    await connectToDatabase();
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      // التحقق من وجود بائع مسجل مسبقًا
      const existingSeller = await Seller.findOne({
        $or: [{ email: data.email }, { userId: userSession.user.id }],
      }).session(dbSession);

      if (existingSeller) {
        await prometheusMetrics.recordRequest('POST', '/api/seller/registration', true, Date.now() - startTime);
        await prometheusMetrics.recordSellerRegistration('success');
        logger.info('Existing seller found', { email: data.email, userId: userSession.user.id });
        return NextResponse.json(
          {
            success: true,
            message: t('messages.sellerExists'),
            data: {
              id: existingSeller._id,
              businessName: existingSeller.businessName,
              email: existingSeller.email,
              subscription: existingSeller.subscription,
              customSiteUrl: existingSeller.customSiteUrl,
              redirect: '/seller/dashboard',
            },
          },
          { status: 200 }
        );
      }

      // التحقق من وجود المستخدم
      const user = await User.findById(new mongoose.Types.ObjectId(userSession.user.id)).session(dbSession);
      if (!user) {
        logger.error('User not found before role update', { userId: userSession.user.id });
        await dbSession.abortTransaction();
        return NextResponse.json(
          { success: false, message: t('errors.userNotFound') },
          { status: 404 }
        );
      }

      // إنشاء ملف تعريف البائع
      const trialEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const customSiteUrl = `seller-${userSession.user.id}`;
      const seller = await Seller.create(
        [
          {
            userId: userSession.user.id,
            businessName: data.businessName,
            email: data.email,
            phone: data.phone,
            description: data.description,
            businessType: data.businessType,
            vatRegistered: data.vatRegistered || false,
            taxId: data.taxId,
            logo: data.logo || undefined,
            address: {
              street: data.address.street,
              city: data.address.city,
              state: data.address.state,
              countryCode: data.address.countryCode,
              postalCode: data.address.postalCode,
            },
            subscription: {
              planId: data.is_trial ? 'trial_plan' : 'basic_plan',
              plan: data.is_trial ? 'Trial' : 'Basic',
              startDate: new Date(),
              endDate: trialEndDate,
              status: 'active',
              features: {
                productsLimit: 50,
                commission: 7,
                prioritySupport: false,
                instantPayouts: false,
                customSectionsLimit: 0,
                domainSupport: false,
                domainRenewal: false,
                analyticsAccess: false,
                abTesting: false,
                pointsRedeemable: false,
                dynamicPaymentGateways: false,
                maxApiKeys: 1,
              },
              price: 1,
              pointsCost: 20,
              isTrial: data.is_trial,
              pointsRedeemed: 0,
            },
            bankInfo: {
              verified: false,
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
              ratingsCount: 0,
              totalSalesHistory: [],
              viewsHistory: [],
              integrationErrors: [],
            },
            settings: {
              notifications: {
                email: true,
                sms: false,
                push: false,
                orderUpdates: true,
                marketingEmails: false,
                pointsNotifications: true,
              },
              display: {
                showRating: true,
                showContactInfo: true,
                showMetrics: true,
                showPointsBalance: true,
                welcomeSeen: false,
              },
              security: {
                twoFactorAuth: false,
                loginNotifications: true,
                ipWhitelist: [],
              },
              customSite: {
                theme: 'default',
                primaryColor: '#000000',
                customSections: [],
                domainStatus: 'pending',
                seo: {
                  metaTitle: '',
                  metaDescription: '',
                  keywords: [],
                },
              },
              language: 'en',
              abTesting: {
                enabled: false,
                experiments: [],
              },
            },
            pointsBalance: 50,
            pointsHistory: [
              {
                amount: 50,
                type: 'credit',
                reason: 'Welcome bonus for new seller registration',
                createdAt: new Date(),
              },
            ],
            freeTrialActive: data.is_trial,
            freeTrialEndDate: trialEndDate,
            trialMonthsUsed: 0,
            customSiteUrl,
            paymentGateways: [],
            integrationIds: [],
            integrations: {},
            taxSettings: {},
            defaultCurrency: 'USD',
            checkoutSettings: {
              customCheckoutEnabled: false,
            },
            isActive: true,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        { session: dbSession }
      );
      console.log('Created seller:', seller[0]);

      // تحديث دور المستخدم
      const updatedUser = await User.findByIdAndUpdate(
        new mongoose.Types.ObjectId(userSession.user.id),
        {
          role: 'SELLER',
          businessProfile: seller[0]._id,
        },
        { new: true, session: dbSession }
      );

      if (!updatedUser) {
        logger.error('User not found for role update', { userId: userSession.user.id });
        await dbSession.abortTransaction();
        return NextResponse.json(
          { success: false, message: t('errors.updateUserRoleFailed') },
          { status: 500 }
        );
      }

      // إرسال إشعارات
      await Promise.all([
        sendNotification({
          userId: userSession.user.id,
          type: 'welcome',
          title: t('notifications.sellerRegistered.title'),
          message: t('notifications.sellerRegistered.message'),
          channels: ['email', 'in_app'],
        }),
        sendNotification({
          userId: userSession.user.id,
          type: 'points.earned',
          title: t('messages.bonusPointsTitle'),
          message: t('messages.bonusPointsMessage', { points: 50 }),
          channels: ['email', 'in_app'],
        }),
        sendNotification({
          userId: userSession.user.id,
          type: 'trial.reminder',
          title: t('messages.trialActiveTitle'),
          message: t('messages.trialActiveMessage', { trialDays: 5 }),
          channels: ['email', 'in_app'],
        }),
      ]);

      await dbSession.commitTransaction();
      await prometheusMetrics.recordRequest('POST', '/api/seller/registration', true, Date.now() - startTime);
      await prometheusMetrics.recordSellerRegistration('success');
      logger.info('Seller registered successfully', { userId: userSession.user.id, sellerId: seller[0]._id });

      return NextResponse.json({
        success: true,
        message: t('messages.success'),
        data: {
          id: seller[0]._id,
          businessName: seller[0].businessName,
          email: seller[0].email,
          role: updatedUser.role,
          subscription: seller[0].subscription,
          customSiteUrl: seller[0].customSiteUrl,
          redirect: '/seller/dashboard',
        },
      });
    } catch (error) {
      if (dbSession.inTransaction()) {
        await dbSession.abortTransaction();
      }
      throw error;
    } finally {
      dbSession.endSession();
    }
  } catch (error) {
    await prometheusMetrics.recordRequest('POST', '/api/seller/registration', false, Date.now() - startTime);
    await prometheusMetrics.recordSellerRegistration('failed');
    const errorMessage = error instanceof Error ? error.message : t('errors.serverError');
    logger.error('Seller registration error', { error: errorMessage });

    if (error instanceof z.ZodError) {
      logger.warn('Validation error', { errors: error.errors });
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: t(err.message, { count: err.path.includes('email') ? 5 : err.path.includes('phone') ? 10 : 2 }),
          })),
        },
        { status: 400 }
      );
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
          errors: Object.values(error.errors).map((err) => ({
            field: err.path,
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    if (error instanceof mongoose.mongo.MongoServerError && error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          message: t('messages.sellerExists'),
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};