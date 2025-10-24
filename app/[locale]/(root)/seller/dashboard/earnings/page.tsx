'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { isValidIBAN, isValidBIC } from 'ibantools';

interface Transaction {
  description: string;
  amount: number;
  date: string;
}

interface PaymentMethod {
  type: string;
  label: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'email' | 'number';
    required: boolean;
  }>;
  verified: boolean;
  accountDetails?: Record<string, string>;
}

const SellerEarningsDashboard = () => {
  const t = useTranslations('SellerEarnings');
  const { toast } = useToast();
  const [balance, setBalance] = useState<number>(0);
  const [earnings, setEarnings] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [accountDetails, setAccountDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/seller/earnings');
        const data = await response.json();
        if (response.ok && data.success) {
          setBalance(data.data.balance);
          setEarnings(data.data.totalEarnings);
          setTransactions(data.data.transactions || []);
          setPaymentMethods(data.data.paymentMethods || []);
          if (data.data.paymentMethods?.length > 0) {
            setSelectedMethod(data.data.paymentMethods[0].type);
          }
        } else {
          toast({
            title: t('errors.fetchFailedTitle'),
            description: data.message || t('errors.fetchFailedDescription'),
            variant: 'destructive',
          });
        }
      } catch (error) {
        toast({
          title: t('errors.fetchFailedTitle'),
          description: t('errors.fetchFailedDescription'),
          variant: 'destructive',
        });
      }
    };

    fetchDashboardData();
  }, [t]);

  const handleAccountDetailChange = (key: string, value: string) => {
    setAccountDetails((prev) => ({ ...prev, [key]: value }));
  };

  const validatePaymentMethod = (method: PaymentMethod): string | null => {
    const details = accountDetails;
    const requiredFields = method.fields.filter((field) => field.required);

    for (const field of requiredFields) {
      if (!details[field.key] || details[field.key].trim() === '') {
        return t('errors.missingField', { field: field.label });
      }
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details[field.key])) {
        return t('errors.invalidEmail', { field: field.label });
      }
      if (field.key.toLowerCase().includes('iban') && !isValidIBAN(details[field.key])) {
        return t('errors.invalidIBAN');
      }
      if (field.key.toLowerCase().includes('swift') && !isValidBIC(details[field.key])) {
        return t('errors.invalidSWIFT');
      }
    }
    return null;
  };

  const handleWithdrawRequest = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({
        title: t('errors.invalidAmountTitle'),
        description: t('errors.invalidAmountDescription'),
        variant: 'destructive',
      });
      return;
    }

    if (parseFloat(withdrawAmount) > balance) {
      toast({
        title: t('errors.exceedBalanceTitle'),
        description: t('errors.exceedBalanceDescription'),
        variant: 'destructive',
      });
      return;
    }

    if (!selectedMethod || paymentMethods.length === 0) {
      toast({
        title: t('errors.noPaymentMethodTitle'),
        description: t('errors.noPaymentMethodDescription'),
        variant: 'destructive',
      });
      return;
    }

    const selectedPaymentMethod = paymentMethods.find((m) => m.type === selectedMethod);
    if (!selectedPaymentMethod) {
      toast({
        title: t('errors.noPaymentMethodTitle'),
        description: t('errors.noPaymentMethodDescription'),
        variant: 'destructive',
      });
      return;
    }

    const validationError = validatePaymentMethod(selectedPaymentMethod);
    if (validationError) {
      toast({
        title: t('errors.invalidPaymentMethodTitle'),
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          paymentMethod: {
            type: selectedMethod,
            accountDetails,
          },
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: t('success.withdrawalTitle'),
          description: t('success.withdrawalDescription'),
        });
        setWithdrawAmount('');
        setBalance((prev) => prev - parseFloat(withdrawAmount));
        setTransactions((prev) => [
          {
            description: `Withdrawal via ${selectedMethod}`,
            amount: parseFloat(withdrawAmount),
            date: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        toast({
          title: t('errors.withdrawalFailedTitle'),
          description: result.message || t('errors.withdrawalFailedDescription'),
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: t('errors.withdrawalFailedTitle'),
        description: t('errors.withdrawalFailedDescription'),
        variant: 'destructive',
      });
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
        <div className="space-y-4">
          <div>
            <p>
              {t('totalEarnings')}: <strong>${earnings.toFixed(2)}</strong>
            </p>
            <p>
              {t('availableBalance')}: <strong>${balance.toFixed(2)}</strong>
            </p>
          </div>

          <div>
            <h3>{t('requestWithdrawal')}</h3>
            {paymentMethods.length > 0 ? (
              <>
                <Select
                  value={selectedMethod}
                  onValueChange={setSelectedMethod}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectPaymentMethod')} />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.type} value={method.type}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedMethod && (
                  <div className="mt-4 space-y-2">
                    {paymentMethods
                      .find((m) => m.type === selectedMethod)
                      ?.fields.map((field) => (
                        <div key={field.key}>
                          <label className="block text-sm font-medium">{field.label}</label>
                          <Input
                            type={field.type}
                            placeholder={field.label}
                            value={accountDetails[field.key] || ''}
                            onChange={(e) => handleAccountDetailChange(field.key, e.target.value)}
                            disabled={loading}
                            required={field.required}
                          />
                        </div>
                      ))}
                  </div>
                )}

                <Input
                  type="number"
                  placeholder={t('enterAmount')}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="my-4"
                  disabled={loading}
                />
                <Button
                  onClick={handleWithdrawRequest}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('submitting')}
                    </>
                  ) : (
                    t('requestWithdrawal')
                  )}
                </Button>
              </>
            ) : (
              <p>{t('noPaymentMethodsAvailable')}</p>
            )}
          </div>

          <div>
            <h3>{t('transactionHistory')}</h3>
            <ul className="space-y-2">
              {transactions.length > 0 ? (
                transactions.map((txn, index) => (
                  <li key={index} className="border p-2 rounded">
                    <p>{txn.description}</p>
                    <p>
                      {t('amount')}: ${txn.amount.toFixed(2)}
                    </p>
                    <p>
                      {t('date')}: {new Date(txn.date).toLocaleDateString()}
                    </p>
                  </li>
                ))
              ) : (
                <p>{t('noTransactions')}</p>
              )}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SellerEarningsDashboard;