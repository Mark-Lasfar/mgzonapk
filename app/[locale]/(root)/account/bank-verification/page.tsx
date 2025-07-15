'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
// import IBAN from 'iban';
import mongoose from 'mongoose';
import stripe from 'stripe';
// import { SellerError } from '@/lib/errors';
import { connectToDatabase } from '@/lib/db';
// import Seller from '@/lib/models/seller.model';
import { encrypt } from '@/lib/utils/encryption';
import { auth } from '@/auth';
import { SellerError } from '@/lib/errors/seller-error';
import Seller from '@/lib/db/models/seller.model';
import isIBAN from 'validator/lib/isIBAN';

// Define the SWIFT code regex for validation
const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

// Define the schema for bank info validation
const BankInfoSchema = z.object({
  accountName: z.string().min(2, 'accountNameTooShort').max(100, 'accountNameTooLong'),
  accountNumber: z.string().refine((value) => isIBAN.isValid(value), 'invalidIBAN'),
  bankName: z.string().min(2, 'bankNameTooShort').max(100, 'bankNameTooLong'),
  swiftCode: z.string().regex(SWIFT_REGEX, 'invalidSwiftCode'),
});

// Initialize Stripe with your API key
const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-10-28.acacia',
});

// Verify bank info with an external API (stubbed for demonstration)
async function verifyBankInfo(accountNumber: string, swiftCode: string): Promise<boolean> {
  try {
    const response = await fetch(`${process.env.BANK_VERIFICATION_API_URL}/verify-bank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountNumber, swiftCode }),
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Bank verification failed:', error);
    return false;
  }
}

// Update seller bank information
export async function updateBankInfo(formData: {
  accountName: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
}) {
  const t = await getTranslations('api');
  const session = await auth();

  if (!session?.user?.id) {
    throw new SellerError(t('errors.unauthenticated'), 'UNAUTHENTICATED');
  }

  try {
    // Validate input
    const validatedData = BankInfoSchema.parse(formData);

    // Verify bank info with external API
    const isBankVerified = await verifyBankInfo(
      validatedData.accountNumber,
      validatedData.swiftCode
    );
    if (!isBankVerified) {
      throw new SellerError(t('errors.invalidBankInfo'), 'INVALID_BANK_INFO');
    }

    await connectToDatabase();
    const dbSession = await mongoose.startSession();

    return await dbSession.withTransaction(async () => {
      const seller = await Seller.findOne({ userId: session.user.id }).session(dbSession);
      if (!seller) {
        throw new SellerError(t('errors.sellerNotFound'), 'SELLER_NOT_FOUND');
      }

      // Encrypt account number
      const encryptedAccountNumber = encrypt(validatedData.accountNumber);

      // Create or update Stripe account
      let stripeAccountId = seller.stripeAccountId;
      if (!stripeAccountId) {
        const stripeAccount = await stripeClient.accounts.create({
          type: 'custom',
          countryCode: seller.address?.countryCode || 'US', // Dynamic country
          email: seller.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: seller.businessType === 'individual' ? 'individual' : 'company',
          business_profile: { name: seller.businessName },
        });
        stripeAccountId = stripeAccount.id;
      }

      // Add external account to Stripe
      await stripeClient.accounts.createExternalAccount(stripeAccountId, {
        external_account: {
          object: 'bank_account',
          country: seller.address?.countryCode || 'US',
          currency: 'usd', // Adjust based on seller's currency
          account_holder_name: validatedData.accountName,
          account_number: validatedData.accountNumber,
          routing_number: validatedData.swiftCode, // Adjust if routing number is separate
        },
      });

      // Update seller with bank info
      seller.bankInfo = {
        accountName: validatedData.accountName,
        accountNumber: encryptedAccountNumber,
        bankName: validatedData.bankName,
        swiftCode: validatedData.swiftCode,
        verified: true,
      };
      seller.stripeAccountId = stripeAccountId;
      await seller.save({ session: dbSession });

      // Revalidate cache
      revalidatePath('/account/bank-verification');
      revalidatePath('/seller/dashboard');

      return { success: true, message: t('bankInfoUpdated') };
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new SellerError(t('errors.invalidData'), 'INVALID_DATA', error.errors);
    }
    if (error instanceof SellerError) {
      throw error;
    }
    console.error('Error updating bank info:', error);
    throw new SellerError(t('errors.serverError'), 'SERVER_ERROR');
  }
}

// Fetch seller bank info
export async function getBankInfo() {
  const t = await getTranslations('api');
  const session = await auth();

  if (!session?.user?.id) {
    throw new SellerError(t('errors.unauthenticated'), 'UNAUTHENTICATED');
  }

  try {
    await connectToDatabase();
    const seller = await Seller.findOne({ userId: session.user.id }).select('bankInfo');

    if (!seller) {
      throw new SellerError(t('errors.sellerNotFound'), 'SELLER_NOT_FOUND');
    }

    return {
      success: true,
      data: {
        accountName: seller.bankInfo?.accountName || '',
        accountNumber: '', // Do not return encrypted account number
        bankName: seller.bankInfo?.bankName || '',
        swiftCode: seller.bankInfo?.swiftCode || '',
        isVerified: seller.bankInfo?.verified || false,
      },
    };
  } catch (error) {
    if (error instanceof SellerError) {
      throw error;
    }
    console.error('Error fetching bank info:', error);
    throw new SellerError(t('errors.serverError'), 'SERVER_ERROR');
  }
}