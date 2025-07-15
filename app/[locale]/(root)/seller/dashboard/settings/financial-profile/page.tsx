import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getBankInfo } from '@/lib/actions/bank.actions';
import FinancialProfileForm from './FinancialProfileForm';

export default async function FinancialProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const t = await getTranslations('SellerDashboard');
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/sign-in`);
  }

  try {
    const bankInfoResult = await getBankInfo(locale);
    if (!bankInfoResult.success || !bankInfoResult.data) {
      return (
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">{t('financialProfile')}</h1>
          <p className="text-red-600">{t('errors.sellerNotFound')}</p>
        </div>
      );
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('financialProfile')}</CardTitle>
          </CardHeader>
          <CardContent>
            <FinancialProfileForm bankInfo={bankInfoResult.data} />
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t('financialProfile')}</h1>
        <p className="text-red-600">Error: {errorMessage}</p>
      </div>
    );
  }
}