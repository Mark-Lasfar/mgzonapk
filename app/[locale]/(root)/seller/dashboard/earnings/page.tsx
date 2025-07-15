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

interface PaymentMethod {
  type: 'bank_transfer' | 'paypal' | 'wise' | 'other';
  accountDetails: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    swiftCode?: string;
    email?: string;
    routingNumber?: string;
  };
  verified: boolean;
}

const SellerEarningsDashboard = () => {
  const t = useTranslations('SellerEarnings');
  const { toast } = useToast();
  const [balance, setBalance] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch('/api/seller/earnings');
        const data = await response.json();
        if (response.ok) {
          setBalance(data.balance);
          setEarnings(data.totalEarnings);
          setTransactions(data.transactions);
          setPaymentMethod(data.paymentMethod || null);
          setSelectedMethod(data.paymentMethod?.type || '');
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

  const validatePaymentMethod = (method: PaymentMethod) => {
    if (method.type === 'bank_transfer') {
      const { accountNumber, swiftCode, accountName, bankName } = method.accountDetails;
      if (!accountName || !accountNumber || !bankName) {
        return t('errors.missingBankDetails');
      }
      if (!isValidIBAN(accountNumber)) {
        return t('errors.invalidIBAN');
      }
      if (swiftCode && !isValidBIC(swiftCode)) {
        return t('errors.invalidSWIFT');
      }
    } else if (method.type === 'paypal' || method.type === 'wise') {
      if (!method.accountDetails.email) {
        return t('errors.missingEmail');
      }
    } else if (method.type === 'other') {
      if (!method.accountDetails.accountName) {
        return t('errors.missingOtherDetails');
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

    if (!paymentMethod || !selectedMethod) {
      toast({
        title: t('errors.noPaymentMethodTitle'),
        description: t('errors.noPaymentMethodDescription'),
        variant: 'destructive',
      });
      return;
    }

    const validationError = validatePaymentMethod(paymentMethod);
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
            accountDetails: paymentMethod.accountDetails,
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
            <Select
              value={selectedMethod}
              onValueChange={setSelectedMethod}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectPaymentMethod')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">{t('paymentMethods.bank_transfer')}</SelectItem>
                <SelectItem value="paypal">{t('paymentMethods.paypal')}</SelectItem>
                <SelectItem value="wise">{t('paymentMethods.wise')}</SelectItem>
                <SelectItem value="other">{t('paymentMethods.other')}</SelectItem>
              </SelectContent>
            </Select>
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
          </div>

          <div>
            <h3>{t('transactionHistory')}</h3>
            <ul className="space-y-2">
              {transactions.length > 0 ? (
                transactions.map((txn: any, index: number) => (
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