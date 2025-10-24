// /home/mark/Music/my-nextjs-project-clean/app/[locale]/(root)/account/bank-verification/page.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@apollo/client/react';
import { GET_BANK_INFO } from '@/graphql/bank/queries';
import BankVerificationForm from '@/components/account/bank/BankVerificationForm';
import { useSession } from 'next-auth/react';

interface BankInfo {
  accountName: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
  routingNumber: string;
  bankDocumentUrl?: string;
  isVerified: boolean;
}

export default function BankVerificationPage() {
  const t = useTranslations('SellerDashboard');
  const { data: session, status } = useSession();

  if (status === 'loading') return <div className="container mx-auto p-6">{t('loading')}</div>;
  if (status === 'unauthenticated') return <div className="container mx-auto p-6">{t('errors.unauthenticated')}</div>;

  const sellerId = session?.user?.id;
  const { data, loading, error } = useQuery(GET_BANK_INFO, {
    variables: { sellerId },
    fetchPolicy: 'network-only',
    skip: !sellerId,
  });

  if (loading) return <div className="container mx-auto p-6">{t('loading')}</div>;
  if (error) return <div className="container mx-auto p-6">{t('errors.serverError')}</div>;

  const bankInfo: BankInfo = data?.getBankInfo || {
    accountName: '',
    accountNumber: '',
    bankName: '',
    swiftCode: '',
    routingNumber: '',
    bankDocumentUrl: '',
    isVerified: false,
  };

  return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">{t('bankVerification.title')}</h1>
        <p className="text-sm text-gray-600 mb-6">{t('messages.bankInfoNote')}</p>
        <BankVerificationForm bankInfo={bankInfo} />
      </div>
  );
}