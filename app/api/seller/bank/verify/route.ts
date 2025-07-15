import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTranslations, getLocale } from 'next-intl/server';
import { updateBankInfo } from '@/lib/actions/bank.actions';
import { z } from 'zod';

const bankInfoSchema = z.object({
  accountName: z.string().min(2).max(100),
  accountNumber: z.string().min(8).max(34),
  bankName: z.string().min(2).max(100),
  swiftCode: z.string().min(8).max(11).regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/).optional(),
});

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

    const data = await request.json();
    const parsedData = bankInfoSchema.parse(data);

    const result = await updateBankInfo(parsedData, locale);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error, code: result.code },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: t('messages.bankInfoVerified'),
      data: { bankInfo: parsedData },
    });
  } catch (error) {
    console.error('Bank verification error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}