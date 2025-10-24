// /app/api/integrations/active/route.ts
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Integration from '@/lib/db/models/integration.model';
import { getTranslations } from 'next-intl/server';

export async function GET(request: Request) {
  const t = await getTranslations('subscriptions');
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ success: false, error: t('errors.missingUserId') }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const integrations = await Integration.find({
      enabledBySellers: userId,
      type: 'payment',
      category: 'payment',
      isActive: true,
      status: 'connected',
    });
    return NextResponse.json({
      success: true,
      data: integrations.map((int: any) => ({
        id: int._id.toString(),
        providerName: int.providerName,
      })),
    });
  } catch (error) {
    console.error('Error fetching payment integrations:', error);
    return NextResponse.json({ success: false, error: t('errors.fetchFailed') }, { status: 500 });
  }
}