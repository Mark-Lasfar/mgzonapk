'use server';

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/auth';
import { getTranslations } from 'next-intl/server';

export async function POST(req: NextRequest) {
  const t = await getTranslations('api');

  try {
    const credentials = await req.json();
    const user = await authenticateUser(credentials);

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : t('errors.authenticationFailed'),
      },
      { status: 401 }
    );
  }
}