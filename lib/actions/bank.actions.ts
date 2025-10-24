'use server';

import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import mongoose from 'mongoose';
import { z } from 'zod';
import Stripe from 'stripe';
import { encrypt } from '@/lib/utils/encryption';
import { getTranslations } from 'next-intl/server';
import { SellerError } from '../errors/seller-error';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import { isValidIBAN } from '../utils/iban';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
});

const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const ROUTING_REGEX = /^\d{9}$/;

const bankInfoSchema = z.object({
  accountName: z.string().min(2, 'accountNameTooShort').max(100, 'accountNameTooLong'),
  accountNumber: z.string().refine((val) => isValidIBAN(val), 'invalidIBAN'),
  bankName: z.string().min(2, 'bankNameTooShort').max(100, 'bankNameTooLong'),
  swiftCode: z.string().regex(SWIFT_REGEX, 'invalidSwiftCode'),
  routingNumber: z.string().regex(ROUTING_REGEX, 'invalidRoutingNumber').optional(),
});

interface BankInfo {
  accountName: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
  routingNumber?: string;
}

export async function updateBankInfo(
  bankInfo: BankInfo,
  locale: string = 'en'
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  code?: string;
}> {
  const t = await getTranslations({ locale, namespace: 'api' });
  const sessionAuth = await auth();

  if (!sessionAuth?.user?.id) {
    return {
      success: false,
      error: t('errors.unauthenticated'),
      code: 'UNAUTHENTICATED',
    };
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await connectToDatabase();

    const validatedData = bankInfoSchema.parse(bankInfo);

    const seller = await Seller.findOne({ userId: sessionAuth.user.id }).session(session);
    if (!seller) {
      return { success: false, error: t('errors.sellerNotFound'), code: 'SELLER_NOT_FOUND' };
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
            iban: validatedData.accountNumber,
            swift: validatedData.swiftCode,
            routingNumber: validatedData.routingNumber,
            countryCode: seller.address?.countryCode || 'US',
            bankDocumentUrl: 'https://placeholder.com/document.pdf', // إضافة placeholder مؤقت
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
              account_holder_name: validatedData.accountName,
              account_number: validatedData.accountNumber,
              routing_number: validatedData.routingNumber || validatedData.swiftCode,
            },
          });
          verificationResult = { success: true, message: 'Bank verified via Stripe' };
        } catch (error) {
          verificationResult = { success: false, message: (error as Error).message || 'Stripe verification failed' };
        }
      } else {
        const integration = await Integration.findOne({ providerName: externalGateway.providerName });
        if (!integration) {
          return {
            success: false,
            error: t('errors.integrationNotFound'),
            code: 'INTEGRATION_NOT_FOUND',
          };
        }
        const endpoint = integration.apiEndpoints.get('verifyBank') || `${integration.settings.apiUrl}/verify-bank`;
        verificationResult = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: integration.settings.authType === 'Bearer' ? `Bearer ${integration.credentials.get('accessToken')}` : '',
          },
          body: JSON.stringify({
            accountName: validatedData.accountName,
            accountNumber: validatedData.accountNumber,
            bankName: validatedData.bankName,
            swiftCode: validatedData.swiftCode,
            routingNumber: validatedData.routingNumber,
          }),
        }).then(res => res.json());
      }
    } else {
      return {
        success: false,
        error: t('errors.noPaymentGateway'),
        code: 'NO_PAYMENT_GATEWAY',
      };
    }

    if (!verificationResult.success) {
      return {
        success: false,
        error: t('errors.verifyData', { message: verificationResult.message }),
        code: 'EXTERNAL_VERIFICATION_FAILED',
      };
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

    const encryptedAccountNumber = await encrypt(validatedData.accountNumber);
    const encryptedSwiftCode = await encrypt(validatedData.swiftCode);
    const encryptedRoutingNumber = validatedData.routingNumber ? await encrypt(validatedData.routingNumber) : undefined;

    seller.bankInfo = {
      accountName: validatedData.accountName,
      accountNumber: encryptedAccountNumber,
      bankName: validatedData.bankName,
      swiftCode: encryptedSwiftCode,
      routingNumber: encryptedRoutingNumber,
      verified: verificationResult.success,
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
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: t('errors.invalidData'),
        code: 'INVALID_DATA',
      };
    }
    console.error('Update bank info error:', error);
    return {
      success: false,
      error: error instanceof SellerError ? error.message : t('errors.serverError'),
      code: error instanceof SellerError ? error.code : 'SERVER_ERROR',
    };
  } finally {
    session.endSession();
  }
}

export async function getBankInfo(locale: string = 'en') {
  const t = await getTranslations({ locale, namespace: 'api' });
  const sessionAuth = await auth();

  if (!sessionAuth?.user?.id) {
    throw new SellerError(t('errors.unauthenticated'), 'UNAUTHENTICATED');
  }

  try {
    await connectToDatabase();
    const seller = await Seller.findOne({ userId: sessionAuth.user.id }).select('bankInfo stripeAccountId');

    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'SELLER_NOT_FOUND');
    }

    return {
      success: true,
      data: {
        accountName: seller.bankInfo?.accountName || '',
        accountNumber: '',
        bankName: seller.bankInfo?.bankName || '',
        swiftCode: '',
        routingNumber: seller.bankInfo?.routingNumber || '',
        isVerified: seller.bankInfo?.verified || false,
      },
    };
  } catch (error) {
    console.error('Get bank info error:', error);
    throw error instanceof SellerError ? error : new SellerError(t('errors.serverError'), 'SERVER_ERROR');
  }
}