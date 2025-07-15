/**
 * Utilities for validating and manipulating International Bank Account Numbers (IBAN),
 * SWIFT/BIC codes, and verifying bank accounts using Stripe and PayPal APIs.
 */
import Stripe from 'stripe';
import axios from 'axios';

/**
 * Regular expression for basic IBAN format validation.
 * Ensures the IBAN starts with two letters, followed by two digits, then up to 30 alphanumeric characters.
 */
const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/;

/**
 * Regular expression for SWIFT/BIC code validation.
 * Ensures 8 or 11 characters: 4 letters (bank code), 2 letters (country code),
 * 2 alphanumeric (location code), and optional 3 alphanumeric (branch code).
 */
const swiftRegex = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/**
 * Map for converting letters to numbers (A=10, B=11, ..., Z=35) as per ISO 13616 standard.
 */
const letterToNumber: { [key: string]: number } = {
  A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 18, J: 19,
  K: 20, L: 21, M: 22, N: 23, O: 24, P: 25, Q: 26, R: 27, S: 28, T: 29,
  U: 30, V: 31, W: 32, X: 33, Y: 34, Z: 35,
};

/**
 * Expected length for IBANs by country code as per ISO 13616 standard.
 */
const ibanLengths: { [key: string]: number } = {
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BE: 16, BA: 20, BR: 29, BG: 22,
  CR: 22, HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28, EG: 29, EE: 20, FI: 18,
  FR: 27, GE: 22, DE: 22, GI: 23, GR: 27, GT: 28, HU: 28, IS: 26, IE: 22,
  IL: 23, IT: 27, JO: 30, KZ: 20, XK: 20, KW: 30, LV: 21, LB: 28, LI: 21,
  LT: 20, LU: 20, MK: 19, MT: 31, MR: 27, MU: 30, MD: 24, MC: 27, ME: 22,
  NL: 18, NO: 15, PK: 24, PS: 29, PL: 28, PT: 25, QA: 29, RO: 24, SM: 27,
  SA: 24, RS: 22, SK: 24, SI: 19, ES: 24, SE: 24, CH: 21, TN: 24, TR: 26,
  UA: 29, AE: 23, GB: 22, VG: 24,
};

/**
 * Initializes Stripe client with the secret key from environment variables.
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

/**
 * Validates an International Bank Account Number (IBAN) according to ISO 13616 standard.
 * @param iban - The IBAN string to validate (case-insensitive, spaces allowed).
 * @returns `true` if the IBAN is valid, `false` otherwise.
 * @example
 * isValidIBAN('GB82WEST12345698765432'); // true
 * isValidIBAN('INVALID'); // false
 * isValidIBAN('gb82 west 1234 5698 7654 32'); // true
 */
export function isValidIBAN(iban: string): boolean {
  if (!iban || typeof iban !== 'string') {
    return false;
  }

  // Remove spaces and convert to uppercase
  const cleanedIban = iban.replace(/\s/g, '').toUpperCase();

  // Check basic format with regex
  if (!ibanRegex.test(cleanedIban)) {
    return false;
  }

  // Check length based on country code
  const countryCode = cleanedIban.slice(0, 2);
  const expectedLength = ibanLengths[countryCode];
  if (!expectedLength || cleanedIban.length !== expectedLength) {
    return false;
  }

  // Rearrange IBAN: Move first 4 characters to the end
  const rearrangedIban = cleanedIban.slice(4) + cleanedIban.slice(0, 4);

  // Convert letters to numbers and build numeric string
  let numericIban = '';
  for (const char of rearrangedIban) {
    numericIban += letterToNumber[char] || char;
  }

  // Perform mod-97 operation
  let remainder = '';
  for (const digit of numericIban) {
    remainder = (Number(remainder + digit) % 97).toString();
  }

  return Number(remainder) === 1;
}

/**
 * Validates a SWIFT/BIC code according to ISO 9362 standard.
 * @param swift - The SWIFT/BIC code to validate (case-insensitive).
 * @returns `true` if the SWIFT code is valid, `false` otherwise.
 * @example
 * isValidSwift('DEUTDEFF'); // true
 * isValidSwift('DEUTDEFF500'); // true
 * isValidSwift('INVALID'); // false
 */
export function isValidSwift(swift: string): boolean {
  if (!swift || typeof swift !== 'string') {
    return false;
  }

  // Remove spaces and convert to uppercase
  const cleanedSwift = swift.replace(/\s/g, '').toUpperCase();

  // Check format with regex
  if (!swiftRegex.test(cleanedSwift)) {
    return false;
  }

  // Validate country code against IBAN country codes
  const countryCode = cleanedSwift.slice(4, 6);
  if (!ibanLengths[countryCode]) {
    return false;
  }

  return true;
}

/**
 * Formats an IBAN for display by adding spaces every 4 characters.
 * @param iban - The IBAN string to format.
 * @returns The formatted IBAN string with spaces, or the original string if invalid.
 * @example
 * formatIBAN('GB82WEST12345698765432'); // 'GB82 WEST 1234 5698 7654 32'
 */
export function formatIBAN(iban: string): string {
  if (!isValidIBAN(iban)) {
    return iban; // Return as-is if invalid
  }
  const cleanedIban = iban.replace(/\s/g, '').toUpperCase();
  return cleanedIban.match(/.{1,4}/g)?.join(' ') || cleanedIban;
}

/**
 * Parses an IBAN to extract its components.
 * @param iban - The IBAN string to parse.
 * @returns An object containing the country code, check digits, and account number, or null if invalid.
 * @example
 * parseIBAN('GB82WEST12345698765432');
 * // { countryCode: 'GB', checkDigits: '82', accountNumber: 'WEST12345698765432' }
 */
export function parseIBAN(iban: string): { countryCode: string; checkDigits: string; accountNumber: string } | null {
  if (!isValidIBAN(iban)) {
    return null;
  }
  const cleanedIban = iban.replace(/\s/g, '').toUpperCase();
  return {
    countryCode: cleanedIban.slice(0, 2),
    checkDigits: cleanedIban.slice(2, 4),
    accountNumber: cleanedIban.slice(4),
  };
}

/**
 * Verifies if a bank account exists using Stripe or PayPal APIs.
 * @param iban - The IBAN of the bank account to verify.
 * @param accountHolderName - The name of the account holder.
 * @param sellerId - The seller's ID in the system (used as Stripe account ID or PayPal merchant ID).
 * @param provider - The payment provider to use for verification ('stripe' or 'paypal').
 * @returns `true` if the account exists and is valid, `false` otherwise.
 * @throws Error if the provider is not supported or if API keys are missing.
 * @example
 * await verifyBankAccount('GB82WEST12345698765432', 'John Doe', 'seller_123', 'stripe'); // true or false
 */
export async function verifyBankAccount(
  iban: string,
  accountHolderName: string,
  sellerId: string,
  provider: 'stripe' | 'paypal'
): Promise<boolean> {
  if (!isValidIBAN(iban)) {
    return false;
  }

  const parsedIban = parseIBAN(iban);
  if (!parsedIban) {
    return false;
  }

  try {
    if (provider === 'stripe') {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('Stripe API key is missing');
      }

      const account = await stripe.accounts.createExternalAccount(sellerId, {
        external_account: {
          object: 'bank_account',
          country: parsedIban.countryCode,
          currency: 'usd', // Adjust based on your system requirements
          account_holder_name: accountHolderName,
          account_number: iban,
        },
      });

      // Stripe will throw an error if the account is invalid
      return !!account;
    } else if (provider === 'paypal') {
      if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
        throw new Error('PayPal API credentials are missing');
      }

      // Get PayPal access token
      const authResponse = await axios.post(
        'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
            ).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const accessToken = authResponse.data.access_token;

      // Verify bank account via PayPal Payouts API (simplified example)
      const payoutResponse = await axios.post(
        'https://api-m.sandbox.paypal.com/v1/payments/payouts',
        {
          sender_batch_header: {
            sender_batch_id: `verify_${sellerId}_${Date.now()}`,
            email_subject: 'Bank Account Verification',
          },
          items: [
            {
              recipient_type: 'BANK_ACCOUNT',
              amount: {
                value: '0.01', // Minimum amount for verification
                currency: 'USD', // Adjust based on your system
              },
              receiver: iban,
              note: 'Test payout for bank account verification',
              sender_item_id: `item_${sellerId}`,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Check if the payout was created successfully
      return payoutResponse.data.batch_header.batch_status === 'PENDING' || payoutResponse.data.batch_header.batch_status === 'SUCCESS';
    } else {
      throw new Error('Unsupported provider. Use "stripe" or "paypal".');
    }
  } catch (error) {
    console.error(`Bank account verification failed with ${provider}:`, error);
    return false;
  }
}