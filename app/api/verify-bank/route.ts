// /home/mark/Music/my-nextjs-project-clean/app/api/verify-bank/route.ts
import { NextResponse } from 'next/server';
// import { isValidIBAN } from 'iban';
import { getTranslations, getLocale } from 'next-intl/server';
import { isValidIBAN } from '@/lib/utils/iban';
import { t } from 'i18next';

const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const STRIPE_COUNTRIES = ['DE', 'FR', 'GB', 'US', 'CA', 'ES', 'IT', 'NL', 'BE', 'AT'];
const PAYPAL_COUNTRIES = ['EG', 'SA', 'AE', 'JO', 'QA', 'KW', 'IN', 'CN', 'PK'];
const ROUTING_REGEX = /^\d{9}$/;
export async function POST(req: Request) {
  try {
    const locale = await getLocale();
    const t = await getTranslations({ locale, namespace: 'api' });

    const { iban, swift, routingNumber, countryCode, bankDocumentUrl } = await req.json();
    if (!isValidIBAN(iban)) {
      return NextResponse.json(
        { valid: false, message: t('errors.invalidIBAN') },
        { status: 400 }
      );
    }

    if (!SWIFT_REGEX.test(swift)) {
      return NextResponse.json(
        { valid: false, message: t('errors.invalidSwift') },
        { status: 400 }
      );
    }

    if (!bankDocumentUrl) {
      return NextResponse.json(
        { valid: false, message: t('errors.missingBankDocument') },
        { status: 400 }
      );
    }
    if (routingNumber && !ROUTING_REGEX.test(routingNumber)) {
      return NextResponse.json(
        { valid: false, message: t('errors.invalidRoutingNumber') },
        { status: 400 }
      );
    }

    const provider = STRIPE_COUNTRIES.includes(countryCode.toUpperCase())
      ? 'stripe'
      : PAYPAL_COUNTRIES.includes(countryCode.toUpperCase())
      ? 'paypal'
      : 'stripe';

    // External API verification (iban.com)
    const response = await fetch(
      `https://api.iban.com/clients/api/swiftv2/bic/?format=json&api_key=${process.env.IBAN_API_KEY}&bic=${encodeURIComponent(swift)}`
    );
    const result = await response.json();

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, message: result.error || t('errors.invalidBankDetails') },
        { status: 400 }
      );
    }

    // Placeholder for document verification (if needed)
    // Example: Verify bankDocumentUrl format or content
    if (!bankDocumentUrl.startsWith('https://')) {
      return NextResponse.json(
        { valid: false, message: t('errors.invalidDocumentUrl') },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: t('messages.verificationSuccessful'),
      bankName: result.bank_name || '',
      provider,
    });
  } catch (err) {
    console.error('Verification error:', err);
    return NextResponse.json(
      { valid: false, message: t('errors.verifyBankFailed') },
      { status: 500 }
    );
  }
}