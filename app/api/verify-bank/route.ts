import { NextResponse } from 'next/server';
import { isValidIBAN } from 'iban';

const SWIFT_REGEX = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

export async function POST(req: Request) {
  try {
    const { iban, swift } = await req.json();

    // Local validation
    if (!isValidIBAN(iban)) {
      return NextResponse.json(
        { valid: false, message: 'Invalid IBAN' },
        { status: 400 }
      );
    }

    if (!SWIFT_REGEX.test(swift)) {
      return NextResponse.json(
        { valid: false, message: 'Invalid SWIFT code' },
        { status: 400 }
      );
    }

    // External API verification (iban.com)
    const response = await fetch(
      `https://api.iban.com/clients/api/swiftv2/bic/?format=json&api_key=${process.env.IBAN_API_KEY}&bic=${encodeURIComponent(swift)}`
    );
    const result = await response.json();

    if (!result.valid) {
      return NextResponse.json(
        { valid: false, message: result.error || 'Invalid bank details' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: 'Verification successful',
      bankName: result.bank_name || '',
    });
  } catch (err) {
    console.error('Verification error:', err);
    return NextResponse.json(
      { valid: false, message: 'Failed to verify bank details with external service' },
      { status: 500 }
    );
  }
}