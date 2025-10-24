import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
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

  return (
    <SellerDetailClient
      sellerId={params.sellerId}
      locale={params.locale}
    />
  );
}