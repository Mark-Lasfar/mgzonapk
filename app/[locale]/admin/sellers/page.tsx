import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import SellersListClient from './SellersListClient';

export default function SellersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const session = await auth();

  if (!session?.user || session.user.role !== 'Admin') {
    redirect(`/${resolvedParams.locale}/sign-in`);
  }

  return (
    <SellersListClient
      initialSearch={resolvedSearchParams.search || ''}
      initialPage={parseInt(resolvedSearchParams.page || '1')}
      locale={resolvedParams.locale}
    />
  );
}