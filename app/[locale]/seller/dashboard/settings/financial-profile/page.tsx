// /home/mark/Music/my-nextjs-project-clean/app/[locale]/(root)/seller/dashboard/settings/financial-profile/page.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { GET_BANK_INFO } from '@/graphql/bank/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import BankVerificationForm from '@/components/account/bank/BankVerificationForm';

interface BankInfo {
  accountName: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
  routingNumber: string;
  bankDocumentUrl?: string;
  isVerified: boolean;
}

interface FinancialProfilePageProps {
  locale: string;
}

export default function FinancialProfilePage({ locale }: FinancialProfilePageProps) {
  const t = useTranslations('SellerDashboard');
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('financialProfile')}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>{t('loading')}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session?.user?.id) {
    router.push(`/${locale}/sign-in`);
    return null;
  }

  if (session.user.role !== 'SELLER') {
    router.push(`/${locale}/seller/dashboard`);
    return null;
  }

  const { data, loading, error } = useQuery(GET_BANK_INFO, {
    variables: { sellerId: session.user.id },
    fetchPolicy: 'network-only',
    skip: !session.user.id,
  });

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('financialProfile')}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>{t('loading')}</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('financialProfile')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{t('errors.serverError')}</p>
              <button
                onClick={() => router.refresh()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                {t('retry')}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('financialProfile')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <BankVerificationForm bankInfo={bankInfo} />
        </CardContent>
      </Card>
    </div>
  );
}