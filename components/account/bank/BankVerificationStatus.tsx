'use client';

import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface BankVerificationStatusProps {
  isVerified: boolean;
}

export default function BankVerificationStatus({ isVerified }: BankVerificationStatusProps) {
  const t = useTranslations('SellerDashboard');

  return (
    <Alert variant={isVerified ? 'default' : 'destructive'} className="mb-6">
      {isVerified ? (
        <CheckCircle className="h-4 w-4" />
      ) : (
        <AlertCircle className="h-4 w-4" />
      )}
      <AlertTitle>
        {isVerified ? t('bankVerification.verified') : t('bankVerification.notVerified')}
      </AlertTitle>
      <AlertDescription>
        {isVerified
          ? t('bankVerification.verifiedMessage')
          : t('bankVerification.notVerifiedMessage')}
      </AlertDescription>
    </Alert>
  );
}