'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';
import { IPointsTransaction } from '@/lib/db/models/points-transaction.model';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Withdrawals() {
  const t = useTranslations('Withdrawals');
  const { data: session, status } = useSession();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState<IPointsTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/seller/balance');
        const result = await response.json();
        if (result.success) {
          setBalance(result.data.pointsBalance || 0);
          setTransactions(result.data.pointsHistory || []);
        } else {
          setError(result.message || t('errors.fetchFailed'));
        }
      } catch (err) {
        setError(t('errors.serverError'));
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.id) {
      fetchData();
    }
  }, [t, session, status, router]);

  const handleWithdraw = async () => {
    if (!amount || Number(amount) < 10) {
      setError(t('errors.invalidAmount'));
      return;
    }
    if (Number(amount) > balance) {
      setError(t('errors.insufficientBalance'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), userId: session?.user?.id }),
      });

      const result = await response.json();
      if (result.success) {
        alert(t('success.withdrawalSubmitted'));
        setAmount('');
        const balanceResponse = await fetch('/api/seller/balance');
        const balanceResult = await balanceResponse.json();
        if (balanceResult.success) {
          setBalance(balanceResult.data.pointsBalance || 0);
          setTransactions(balanceResult.data.pointsHistory || []);
        }
      } else {
        setError(result.message || t('errors.withdrawalFailed'));
      }
    } catch (err) {
      setError(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="max-w-4xl mx-auto p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h1 className="h1-bold py-4 text-center">{t('title')}</h1>
      {status === 'loading' ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">{t('loading')}</span>
        </div>
      ) : (
        <Card className="shadow-lg border-none bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900">
          <CardHeader>
            <CardTitle className="text-2xl">{t('balance')}</CardTitle>
            <p className="text-3xl font-bold text-primary">
              {balance} {t('points')}
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Input
                type="number"
                placeholder={t('amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                min="10"
                className="flex-1"
              />
              <Button
                onClick={handleWithdraw}
                disabled={loading}
                className="bg-primary hover:bg-primary-dark transition-colors"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {t('requestWithdrawal')}
              </Button>
            </div>
            <h2 className="text-xl font-semibold mb-4">{t('transactionHistory')}</h2>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground">{t('noTransactions')}</p>
            ) : (
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
                  {transactions.map((tx: IPointsTransaction, index: number) => (
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
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}