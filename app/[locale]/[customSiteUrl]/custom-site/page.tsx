import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Bell, CreditCard, Lock, Palette, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import crypto from 'crypto';

async function sendLog(type: 'info' | 'error', message: string, meta?: any) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, message, meta }),
    });
  } catch (err) {
    console.error('Failed to send log:', err);
  }
}

interface SettingsCardProps {
  title: string;
  description: string;
  link: string;
  icon: React.ReactNode;
  locale: string;
  badge?: React.ReactNode;
}

function SettingsCard({ title, description, link, icon, locale, badge }: SettingsCardProps) {
  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">{description}</p>
          <Button asChild variant="outline">
            <Link href={`/${locale}${link}`}>
              {title} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
      {badge && <div className="mt-2">{badge}</div>}
    </div>
  );
}

async function checkSubscription(seller: any, locale: string, t: any) {
  if (seller.subscription?.status !== 'active') {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t('settingsTitle')}</h1>
        <p className="text-red-600">{t('errors.inactiveSubscription')}</p>
        <Link
          href={`/${locale}/seller/dashboard/subscription`}
          className="text-blue-600 hover:underline"
        >
          {t('manageSubscription')}
        </Link>
      </div>
    );
  }
  return null;
}

export default async function SellerSettingsPage({
  params,
}: {
  params: Promise<{ locale: string; customSiteUrl: string }>;
}) {
  const t = await getTranslations('SellerDashboard');
  const { locale, customSiteUrl } = await params;
  const session = await auth();
  const requestId = crypto.randomUUID();

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

  const seller = sellerResult.data;
  const subscriptionError = await checkSubscription(seller, locale, t);
  if (subscriptionError) {
    await sendLog('error', t('errors.inactiveSubscription'), { requestId, userId: session.user.id });
    return subscriptionError;
  }

  // جلب عدد الإشعارات غير المقروءة عبر API
  const notificationsResponse = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/notifications?action=getUnreadCount&userId=${session.user.id}`
  );
  const notificationsResult = await notificationsResponse.json();
  const unreadNotifications = notificationsResult.success ? notificationsResult.data : 0;
  if (!notificationsResult.success) {
    await sendLog('error', t('errors.failedToFetchNotifications'), { requestId, userId: session.user.id });
  } else {
    await sendLog('info', t('Fetched unread notifications count'), { requestId, userId: session.user.id, count: unreadNotifications });
  }

  const settingsCards = [
    {
      title: t('accountSettings'),
      description: t('manageAccount'),
      link: '/seller/dashboard/settings/account',
      icon: <User className="h-5 w-5" />,
      locale,
    },
    {
      title: t('notificationSettings'),
      description: t('manageNotifications'),
      link: '/seller/dashboard/settings/notifications',
      icon: <Bell className="h-5 w-5" />,
      badge: unreadNotifications > 0 && (
        <Badge variant="destructive">{unreadNotifications} {t('unread')}</Badge>
      ),
      locale,
    },
    {
      title: t('securitySettings'),
      description: t('manageSecurity'),
      link: '/seller/dashboard/settings/security',
      icon: <Lock className="h-5 w-5" />,
      locale,
    },
    {
      title: t('customizeSite'),
      description: t('manageCustomSite'),
      link: '/seller/dashboard/settings/custom-site',
      icon: <Palette className="h-5 w-5" />,
      locale,
    },
    {
      title: t('subscriptionSettings'),
      description: t('manageSubscription'),
      link: '/seller/dashboard/subscription',
      icon: <CreditCard className="h-5 w-5" />,
      locale,
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('settingsTitle')}</h1>
        <p className="text-gray-600 mt-2">
          {t('settingsDescription', { businessName: seller.businessName })}
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Badge variant="secondary">
            {t('pointsBalance')}: {seller.pointsBalance}
          </Badge>
          <Badge variant={seller.subscription.plan === 'VIP' ? 'default' : 'outline'}>
            {t('plan')}: {seller.subscription.plan}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCards.map((card) => (
          <SettingsCard key={card.title} {...card} />
        ))}
      </div>
    </div>
  );
}