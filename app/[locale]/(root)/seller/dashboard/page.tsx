'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Copy, Share2 } from 'lucide-react';

import BrowsingHistoryList from '@/components/shared/browsing-history-list'

import { getPointsBalance, getPointsHistory } from '@/lib/actions/points.actions'
import { formatDateTime } from '@/lib/utils'

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  averageRating: number;
  lastUpdate: string;
  monthlyStats: {
    revenue: number;
    orders: number;
    averageValue: number;
  };
  salesData: Array<{
    name: string;
    sales: number;
  }>;
}

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function DashboardPage() {
  const t = useTranslations('Dashboard');
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customSiteUrl, setCustomSiteUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0,
    totalOrders: 0,
    totalProducts: 0,
    averageRating: 0,
    lastUpdate: new Date().toISOString(),
    monthlyStats: {
      revenue: 0,
      orders: 0,
      averageValue: 0,
    },
    salesData: [],
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pointsBalance, setPointsBalance] = useState<number>(0);
  const [pointsHistory, setPointsHistory] = useState<
    Array<{ _id: string; amount: number; type: 'earn' | 'redeem'; description: string; createdAt: Date }>
  >([]);

  useEffect(() => {
    const loadData = async () => {
      if (status !== 'authenticated' || session?.user?.role !== 'SELLER') {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        // جلب بيانات الـ Dashboard
        const statsRes = await fetch('/api/seller/dashboard');
        if (!statsRes.ok) {
          throw new Error(t('errors.fetchFailed'));
        }
        const statsData = await statsRes.json();
        if (!statsData.success) {
          throw new Error(statsData.message || t('errors.fetchFailed'));
        }
        setStats({
          ...statsData.data,
          lastUpdate: new Date().toISOString(),
        });

        // جلب بيانات الملف الشخصي
        const profileRes = await fetch('/api/seller/profile');
        if (!profileRes.ok) {
          throw new Error(t('errors.fetchProfileFailed'));
        }
        const profileData = await profileRes.json();
        if (profileData.success && profileData.data.customSiteUrl) {
          setCustomSiteUrl(profileData.data.customSiteUrl);
        }

        // جلب الإشعارات
        const notificationsRes = await fetch('/api/seller/notifications?limit=10&skip=0');
        if (!notificationsRes.ok) {
          throw new Error(t('errors.fetchNotificationsFailed'));
        }
        const notificationsData = await notificationsRes.json();
        if (!notificationsData.success) {
          throw new Error(notificationsData.message || t('errors.fetchNotificationsFailed'));
        }
        setNotifications(notificationsData.data);

        // جلب رصيد النقاط وتاريخ النقاط
        const pointsBalanceData = await getPointsBalance(session.user.id);
        const pointsHistoryData = await getPointsHistory(session.user.id);

        setPointsBalance(pointsBalanceData);
        setPointsHistory(pointsHistoryData);

      } catch (err) {
        setError(t('errors.fetchFailed'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [t, status, session]);

  const formattedDate = new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(stats.lastUpdate));

  const userName = session?.user?.name || 'مستخدم غير معروف';
  const siteLink = customSiteUrl
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/${session?.user?.locale || 'en'}/${customSiteUrl}`
    : '';

  const handleCopyLink = () => {
    if (siteLink) {
      navigator.clipboard.writeText(siteLink);
      alert(t('siteLinkCopied'));
    }
  };

  const handleShareLink = async () => {
    if (siteLink && navigator.share) {
      try {
        await navigator.share({
          title: t('shareSiteTitle', { businessName: session?.user?.name }),
          text: t('shareSiteText'),
          url: siteLink,
        });
      } catch (err) {
        console.error('فشل المشاركة:', err);
      }
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <div className="p-6">{t('errors.unauthenticated')}</div>;
  }

  if (session?.user?.role !== 'SELLER') {
    return <div className="p-6">{t('errors.accessDenied')}</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <Button
          onClick={() => window.location.reload()}
          className="px-4 py-2"
        >
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {customSiteUrl && (
          <div className="flex items-center space-x-2">
            <Input
              value={siteLink}
              readOnly
              className="w-full sm:w-64"
              placeholder={t('siteLinkPlaceholder')}
            />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('copySiteLink')}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShareLink}
                    disabled={!navigator.share}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('shareSiteLink')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
        <div className="text-sm text-gray-500">{formattedDate}</div>
      </div>

      {/* قسم الإشعارات */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{t('notifications')}</CardTitle>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-gray-500">{t('noNotifications')}</p>
          ) : (
            <ul className="space-y-2">
              {notifications.map((notification) => (
                <li
                  key={notification._id}
                  className={`p-2 rounded ${notification.read ? 'bg-gray-100' : 'bg-blue-50'}`}
                >
                  <p className="font-semibold">{notification.title}</p>
                  <p>{notification.message}</p>
                  <p className="text-sm text-gray-500">
                    {new Intl.DateTimeFormat('ar-EG', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(notification.createdAt))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* بيانات الإحصائيات والنقاط */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('totalSales')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('totalOrders')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('totalProducts')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('averageRating')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)} ⭐</div>
          </CardContent>
        </Card>
      </div>

      {/* رسومات بيانية */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{t('weeklySales')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="sales" fill="#8884d8" name={t('sales')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>{t('monthlyOverview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('monthlyRevenue')}</span>
              <span className="font-semibold">{formatCurrency(stats.monthlyStats.revenue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('monthlyOrders')}</span>
              <span className="font-semibold">{stats.monthlyStats.orders}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">{t('averageOrderValue')}</span>
              <span className="font-semibold">{formatCurrency(stats.monthlyStats.averageValue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-bold">Points Balance</h2>
        <p className="text-muted-foreground">Your current points: {pointsBalance}</p>
        <h3 className="text-lg font-bold mt-4">Points History</h3>
        <div className="mt-2">
          {pointsHistory.length > 0 ? (
            <ul className="space-y-2">
              {pointsHistory.map((tx) => (
                <li key={tx._id} className="border-b py-2">
                  <p>{tx.description}</p>
                  <p>
                    {tx.type === 'earn' ? '+' : '-'}{tx.amount} points on{' '}
                    {formatDateTime(tx.createdAt).dateTime}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No points transactions yet.</p>
          )}
        </div>
      </div>

      <BrowsingHistoryList className="mt-16" />

      <div className="text-center text-sm text-gray-500">
        <p>{t('loggedInAs', { user: userName })}</p>
        <p>{t('lastUpdated', { time: formattedDate })}</p>
      </div>
    </div>
  );
}
