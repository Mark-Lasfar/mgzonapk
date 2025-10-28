// /home/mark/Music/my-nextjs-project-clean/app/[locale]/(root)/seller/dashboard/settings/custom-site/page.tsx
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import crypto from 'crypto';
import { SettingsFormData } from '@/lib/types/settings';
import Link from 'next/link';
import SellerCustomSiteFormWrapper from '@/components/seller/SellerCustomSiteFormWrapper';

async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, meta, timestamp: new Date().toISOString() }),
    });
  } catch (err) {
    console.error('Failed to send log:', err);
  }
}

export default async function SellerSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations('SellerDashboard');
  const { locale } = await params;
  const session = await auth();
  const requestId = crypto.randomUUID();

  // Redirect to sign-in if user is not authenticated
  if (!session?.user) {
    await sendLog('error', t('errors.unauthorized'), { requestId });
    redirect(`/${locale}/sign-in`);
  }

  // جلب بيانات البائع عبر API
  const sellerResponse = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/seller?userId=${session.user.id}&locale=${locale}`
  );
  const sellerResult = await sellerResponse.json();
  if (!sellerResult.success || !sellerResult.data) {
    await sendLog('error', t('errors.sellerNotFound'), { requestId, userId: session.user.id });
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t('settingsTitle')}</h1>
        <p className="text-red-600">{t('errors.sellerNotFound')}</p>
      </div>
    );
  }

  const seller: SettingsFormData = sellerResult.data;

  // Check if subscription is active
  if (seller.subscription?.status !== 'active') {
    await sendLog('error', t('errors.inactiveSubscription'), { requestId, userId: session.user.id });
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t('settingsTitle')}</h1>
        <p className="text-red-600">{t('errors.inactiveSubscription')}</p>
        <Link href={`/${locale}/seller/dashboard/subscription`} className="text-blue-600 hover:underline">
          {t('manageSubscription')}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{t('settingsTitle')}</h1>
      <SellerCustomSiteFormWrapper defaultValues={seller} locale={locale} />
    </div>
  );
}