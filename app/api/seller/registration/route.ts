import { connectToDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import Seller from '@/lib/db/models/seller.model';
import User from '@/lib/db/models/user.model';
import mongoose from 'mongoose';
import { z } from 'zod';
import { uploadToStorage } from '@/lib/utils/s3';
import { getTranslations, getLocale } from 'next-intl/server';
import { isValidIBAN } from 'iban';
import { sendNotification } from '@/lib/actions/notification.actions';

const sellerRegistrationSchema = z.object({
  businessName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(20).regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/),
  description: z.string().min(50).max(500).optional(),
  businessType: z.enum(['individual', 'company']),
  vatRegistered: z.boolean().default(false),
  logo: z.string().optional(),
  address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
    postalCode: z.string().min(1),
  }),
  taxId: z.string().min(1),
  bankInfo: z.object({
    accountName: z.string().min(2),
    accountNumber: z.string().min(8),
    bankName: z.string().min(2),
    swiftCode: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/),
  }),
  termsAccepted: z.boolean().refine((val) => val === true),
});

type SellerRegistrationData = z.infer<typeof sellerRegistrationSchema>;

export async function POST(request: NextRequest) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api' });

    const userSession = await auth();
    if (!userSession?.user?.id) {
      return NextResponse.json(
        { success: false, message: t('errors.unauthorized') },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    let data: SellerRegistrationData;
    let logoUrl = '';

    try {
      const jsonData = formData.get('data');
      if (!jsonData || typeof jsonData !== 'string') {
        throw new Error(t('errors.invalidFormData'));
      }

      const parsedData = JSON.parse(jsonData);

      if (parsedData.bankInfo.accountNumber && !isValidIBAN(parsedData.bankInfo.accountNumber)) {
        return NextResponse.json(
          { success: false, message: t('errors.invalidBankAccount') },
          { status: 400 }
        );
      }

      const logoFile = formData.get('logo') as File | null;
      if (logoFile) {
        const maxSize = 5 * 1024 * 1024;
        if (logoFile.size > maxSize) {
          return NextResponse.json(
            { success: false, message: t('errors.logoSizeExceed') },
            { status: 400 }
          );
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(logoFile.type)) {
          return NextResponse.json(
            { success: false, message: t('errors.invalidLogoType') },
            { status: 400 }
          );
        }

        const arrayBuffer = await logoFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        logoUrl = await uploadToStorage(buffer, `sellers/${userSession.user.id}/logo`, {
          folder: 'sellers',
          resource_type: 'image',
          allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
          public_id: `${userSession.user.id}-${Date.now()}`,
          overwrite: true,
        });

        parsedData.logo = logoUrl;
      }

      data = sellerRegistrationSchema.parse(parsedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            message: t('errors.invalidData'),
            errors: error.errors.map((err) => ({
              path: err.path.join('.'),
              message: err.message,
            })),
          },
          { status: 400 }
        );
      }
      console.error('Parse error:', error);
      return NextResponse.json(
        { success: false, message: t('errors.parseFailed') },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      const existingSeller = await Seller.findOne({
        $or: [{ email: data.email }, { userId: userSession.user.id }],
      }).session(dbSession);

      if (existingSeller) {
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

      const trialEndDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const seller = await Seller.create(
        [
          {
            userId: userSession.user.id,
            businessName: data.businessName,
            email: data.email,
            phone: data.phone,
            description: data.description,
            businessType: data.businessType,
            vatRegistered: data.vatRegistered,
            logo: logoUrl || undefined,
            address: data.address,
            taxId: data.taxId,
            bankInfo: {
              accountName: data.bankInfo.accountName,
              accountNumber: data.bankInfo.accountNumber,
              bankName: data.bankInfo.bankName,
              swiftCode: data.bankInfo.swiftCode,
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
              documents: {},
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
            customSiteUrl: `/seller/${userSession.user.id}`,
          },
        ],
        { session: dbSession }
      );

      const updatedUser = await User.findByIdAndUpdate(
        userSession.user.id,
        {
          role: 'SELLER',
          businessProfile: seller[0]._id,
        },
        { new: true, session: dbSession }
      );

      if (!updatedUser) {
        throw new Error(t('errors.updateUserRoleFailed'));
      }

      await sendNotification({
        userId: userSession.user.id,
        type: 'seller_registered',
        title: t('notifications.sellerRegistered.title'),
        message: t('notifications.sellerRegistered.message'),
        channels: ['email', 'in_app'],
      });

      await dbSession.commitTransaction();

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
        },
      });
    } catch (error) {
      if (dbSession.inTransaction()) {
        await dbSession.abortTransaction();
      }
      console.error('Transaction error:', error);
      throw error;
    } finally {
      await dbSession.endSession();
    }
  } catch (error) {
    console.error('Seller registration error:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(
        {
          success: false,
          message: t('errors.invalidData'),
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        message: t('errors.serverError'),
      },
      { status: 500 }
    );
  }
}
