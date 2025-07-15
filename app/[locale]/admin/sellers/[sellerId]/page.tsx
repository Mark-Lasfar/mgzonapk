import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getSellerById, getSellerMetrics } from '@/lib/actions/seller.actions';
import SellerDetailClient from './SellerDetailClient';

export default async function SellerDetailPage({
  params,
}: {
  params: { locale: string; sellerId: string };
}) {
  const t = await getTranslations('Admin.sellers');
  const session = await auth();

  if (!session?.user || session.user.role !== 'Admin') {
    redirect(`/${params.locale}/sign-in`);
  }

  const sellerResult = await getSellerById(decodeURIComponent(params.sellerId), params.locale);
  const metricsResult = await getSellerMetrics(params.sellerId, params.locale);

  if (!sellerResult.success) {
    return <div className="container mx-auto px-4 py-8 text-red-600">{`${t('error')}: ${sellerResult.error}`}</div>;
  }

  if (!sellerResult.data) {
    return <div className="container mx-auto px-4 py-8">{t('noSellerData')}</div>;
  }

  return (
    <SellerDetailClient
      seller={sellerResult.data}
      metrics={metricsResult}
      locale={params.locale}
      t={t}
    />
  );
}