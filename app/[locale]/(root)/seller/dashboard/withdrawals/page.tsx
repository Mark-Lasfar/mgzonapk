'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

export default function Withdrawals() {
  const t = useTranslations('seller.withdrawals');
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/seller/balance');
        const result = await response.json();
        if (result.success) {
          setBalance(result.balance || 0);
          setTransactions(result.transactions || []);
        } else {
          setError(result.message || t('errors.fetchFailed'));
        }
      } catch (err) {
        setError(t('errors.serverError'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [t]);

  const handleWithdraw = async () => {
    if (!amount || Number(amount) <= 0) {
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
        // Refresh balance and transactions
        const balanceResponse = await fetch('/api/seller/balance');
        const balanceResult = await balanceResponse.json();
        if (balanceResult.success) {
          setBalance(balanceResult.balance || 0);
          setTransactions(balanceResult.transactions || []);
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
    <Card className="max-w-4xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>{t('loading')}</p>
        ) : (
          <>
            <p>
              {t('balance')}: ${balance.toFixed(2)}
            </p>
            {error && <p className="text-red-500">{error}</p>}
            <div className="flex space-x-4 my-4">
              <Input
                type="number"
                placeholder={t('amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
              />
              <Button onClick={handleWithdraw} disabled={loading}>
                {t('requestWithdrawal')}
              </Button>
            </div>
            <h2>{t('transactionHistory')}</h2>
            {transactions.length === 0 ? (
              <p>{t('noTransactions')}</p>
            ) : (
              <ul className="space-y-2">
                {transactions.map((txn, index) => (
                  <li key={index} className="border p-2 rounded">
                    {txn.description}: ${txn.amount.toFixed(2)} (
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