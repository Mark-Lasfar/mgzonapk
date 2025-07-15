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
import BrowsingHistoryList from '@/components/shared/browsing-history-list';
import { getPointsBalance, getPointsHistory } from '@/lib/actions/points.actions';
import { formatDateTime } from '@/lib/utils';
import Confetti from 'react-confetti';
import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  salesData: Array<{ name: string; sales: number }>;
}

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface PointsTransaction {
  _id?: string;
  amount: number;
  type: 'earn' | 'redeem';
  description: string;
  createdAt: Date | string;
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
    monthlyStats: { revenue: 0, orders: 0, averageValue: 0 },
    salesData: [],
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pointsBalance, setPointsBalance] = useState<number>(0);
  const [pointsHistory, setPointsHistory] = useState<PointsTransaction[]>([]);
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (status !== 'authenticated' || session?.user?.role !== 'SELLER') {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);

        const [statsRes, profileRes, notificationsRes, pointsBalanceData, pointsHistoryData, welcomeRes] =
          await Promise.all([
            fetch('/api/seller/dashboard'),
            fetch('/api/seller/profile'),
            fetch('/api/seller/notifications?limit=10&skip=0'),
            session.user.id ? getPointsBalance(session.user.id) : Promise.resolve(0),
            session.user.id ? getPointsHistory(session.user.id) : Promise.resolve([]),
            fetch('/api/seller/welcome-status'),
          ]);

        if (!statsRes.ok) throw new Error(t('errors.fetchFailed'));
        const statsData = await statsRes.json();
        if (!statsData.success) throw new Error(statsData.message || t('errors.fetchFailed'));
        setStats({ ...statsData.data, lastUpdate: new Date().toISOString() });

        if (!profileRes.ok) throw new Error(t('errors.fetchProfileFailed'));
        const profileData = await profileRes.json();
        if (profileData.success && profileData.data.customSiteUrl) {
          setCustomSiteUrl(profileData.data.customSiteUrl);
        }

        if (!notificationsRes.ok) throw new Error(t('errors.fetchNotificationsFailed'));
        const notificationsData = await notificationsRes.json();
        if (!notificationsData.success)
          throw new Error(notificationsData.message || t('errors.fetchNotificationsFailed'));
        setNotifications(notificationsData.data);

        setPointsBalance(pointsBalanceData);
        setPointsHistory(
          pointsHistoryData.map((tx: PointsTransaction) => ({
            ...tx,
            createdAt: typeof tx.createdAt === 'string' ? new Date(tx.createdAt) : tx.createdAt,
          }))
        );

        if (welcomeRes.ok) {
          const welcomeData = await welcomeRes.json();
          if (welcomeData.success && welcomeData.showWelcome) {
            setShowWelcome(true);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
          }
        }
      } catch (err) {
        setError(t('errors.fetchFailed'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [t, status, session]);

  const handleRedeemPoints = async () => {
    if (!session?.user?.id) return;
    setRedeemLoading(true);
    setRedeemError(null);
    try {
      const response = await fetch('/api/seller/redeem-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: 50,
          currency: 'usd',
          description: 'Redeem points for subscription discount',
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || t('errors.pointsRedeemFailed'));
      }
      setPointsBalance(data.data.pointsBalance || pointsBalance - 50);
      setPointsHistory([
        {
          amount: 50,
          type: 'redeem',
          description: 'Redeem points for subscription discount',
          createdAt: new Date(),
        },
        ...pointsHistory,
      ]);
      alert(t('messages.pointsRedeemed'));
    } catch (err: any) {
      setRedeemError(err.message || t('errors.pointsRedeemFailed'));
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleCloseWelcome = async () => {
    setShowWelcome(false);
    try {
      await fetch('/api/seller/welcome-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seen: true }),
      });
    } catch (err) {
      console.error('Failed to update welcome status:', err);
    }
  };

  const formattedDate = new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(stats.lastUpdate));

  const userName = session?.user?.name || t('unknownUser');
  const siteLink = customSiteUrl
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/en/${customSiteUrl}`
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
          title: t('shareSiteTitle', { businessName: session?.user?.name || '' }),
          text: t('shareSiteText'),
          url: siteLink,
        });
      } catch (err) {
        console.error('Share failed:', err);
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
        <Button onClick={() => window.location.reload()} className="px-4 py-2">
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {showConfetti && <Confetti width={window.innerWidth} height={window.innerHeight} />}
      <Dialog open={showWelcome} onOpenChange={handleCloseWelcome}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('welcome.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>{t('welcome.message', { name: userName })}</p>
            <p>{t('welcome.points', { points: 50 })}</p>
            <p>{t('welcome.pointsUsage')}</p>
            <p>{t('welcome.withdrawalInfo')}</p>
            <motion.div
              className="flex justify-center space-x-4"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {['🎈', '🎉', '🎁'].map((emoji, index) => (
                <motion.span
                  key={index}
                  animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                  className="text-2xl"
                >
                  {emoji}
                </motion.span>
              ))}
            </motion.div>
            <Button onClick={handleCloseWelcome}>{t('welcome.close')}</Button>
          </div>
        </DialogContent>
      </Dialog>

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
      </div>
      <div className="text-sm text-gray-500">{formattedDate}</div>

      <Card className="bg-card">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('totalSales')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalSales)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('totalOrders')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('totalProducts')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t('averageRating')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)} ⭐</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card">
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
                <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="sales" fill="#8884d8" name={t('sales')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
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

      <Card className="bg-card">
        <CardHeader>
          <CardTitle>{t('points')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">
              {t('currentPointsBalance', { points: pointsBalance })}
            </p>
            {redeemError && <p className="text-red-500">{redeemError}</p>}
            {pointsBalance >= 50 && (
              <Button onClick={handleRedeemPoints} disabled={redeemLoading}>
                {redeemLoading ? t('redeeming') : t('redeemPoints')}
              </Button>
            )}
            <h3 className="text-lg font-semibold">{t('pointsHistory')}</h3>
            {pointsHistory.length > 0 ? (
              <ul className="space-y-2">
                {pointsHistory.map((tx) => (
                  <li key={tx._id} className="border-b py-2">
                    <p>{tx.description}</p>
                    <p>
                      {tx.type === 'earn' ? '+' : '-'}{tx.amount} {t('points')} on{' '}
                      {formatDateTime(new Date(tx.createdAt)).dateTime}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('noPointsTransactions')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <BrowsingHistoryList className="mt-16" />

      <div className="text-center text-sm text-gray-500">
        <p>{t('loggedInAs', { user: userName })}</p>
        <p>{t('lastUpdated', { time: formattedDate })}</p>
      </div>
    </div>
  );
}