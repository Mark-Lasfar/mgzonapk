'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';
import { IPointsTransaction } from '@/lib/db/models/points-transaction.model';
import CreateCouponForm from '@/components/seller/CreateCouponForm';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface SellerMetrics {
  points: {
    balance: number;
    earned: number;
    redeemed: number;
    recentTransactions: IPointsTransaction[];
  };
}

export default function SellerPointsDashboard() {
  const t = useTranslations('sellerPointsDashboard');
  const router = useRouter();
  const [metrics, setMetrics] = useState<SellerMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/seller/metrics', {
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (!data.success) {
          setError(data.error || t('errors.fetchMetricsFailed'));
          return;
        }
        setMetrics(data.data);
      } catch (err) {
        setError(t('errors.fetchMetricsFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [t]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-red-500">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">{t('loading')}</span>
      </div>
    );
  }

  if (!metrics) {
    return <div className="flex items-center justify-center min-h-[50vh]">{t('unauthorized')}</div>;
  }

  const points = metrics.points;

  return (
    <motion.div
      className="max-w-6xl mx-auto p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="h1-bold py-4 text-center">{t('title')}</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { title: t('pointsBalance'), value: points.balance },
          { title: t('totalEarned'), value: points.earned },
          { title: t('totalRedeemed'), value: points.redeemed },
        ].map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Card className="shadow-lg border-none bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-primary">
                  {item.value} {t('points')}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <Card className="mt-8 shadow-lg border-none bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
        <CardHeader>
          <CardTitle>{t('recentTransactions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {points.recentTransactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('table.date')}</TableHead>
                  <TableHead>{t('table.type')}</TableHead>
                  <TableHead>{t('table.amount')}</TableHead>
                  <TableHead>{t('table.description')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.recentTransactions.map((tx: IPointsTransaction, index: number) => (
                  <TableRow key={index}>
                    <TableCell>{formatDateTime(tx.createdAt).dateTime}</TableCell>
                    <TableCell>
                      {tx.type === 'earn' ? t('table.earned') : t('table.redeemed')}
                    </TableCell>
                    <TableCell>
                      {tx.type === 'earn' ? '+' : '-'}{tx.amount}
                    </TableCell>
                    <TableCell>{tx.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">{t('noRecentTransactions')}</p>
          )}
        </CardContent>
      </Card>
      <Card className="mt-8 shadow-lg border-none bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
        <CardHeader>
          <CardTitle>{t('createCoupon.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateCouponForm />
        </CardContent>
      </Card>
    </motion.div>
  );
}