'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Transaction {
  amount: number;
  type: 'credit' | 'debit';
  reason: string;
  createdAt: string;
}

export default function Withdrawals() {
  const t = useTranslations('seller.withdrawals');
  const { data: session, status } = useSession();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
        body: JSON.stringify({ amount: Number(amount) }),
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

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen">{t('loading')}</div>;
  }

  return (
    <Card className="max-w-4xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>{t('loading')}</p>
        ) : (
          <>
            <p className="text-lg font-semibold">
              {t('balance')}: {balance} {t('points')}
            </p>
            {error && <p className="text-red-500 mt-2">{error}</p>}
            <div className="flex space-x-4 my-4">
              <Input
                type="number"
                placeholder={t('amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                min="10"
              />
              <Button onClick={handleWithdraw} disabled={loading}>
                {t('requestWithdrawal')}
              </Button>
            </div>
            <h2 className="text-xl font-semibold mt-6">{t('transactionHistory')}</h2>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground">{t('noTransactions')}</p>
            ) : (
              <ul className="space-y-2 mt-4">
                {transactions.map((txn, index) => (
                  <li key={index} className="border p-2 rounded">
                    {txn.reason}: {txn.type === 'credit' ? '+' : '-'}{txn.amount} {t('points')} (
                    {new Date(txn.createdAt).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}