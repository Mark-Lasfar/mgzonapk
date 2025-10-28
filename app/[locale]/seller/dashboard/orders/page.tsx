import { Metadata } from 'next';
import { auth } from '@/auth';
import { getSellerOrders } from '@/lib/actions/seller.actions';
import OrderList from './order-list';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = {
  title: 'Seller Orders',
};

export default async function SellerOrders({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const t = await getTranslations('Checkout');
  const [session, resolvedSearchParams] = await Promise.all([
    auth(),
    searchParams,
  ]);

  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  const page = Number(resolvedSearchParams.page) || 1;
  const result = await getSellerOrders(session.user.id, {
    page,
    status: resolvedSearchParams.status,
  });

  if (!result || !result.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t('order summary')}</h1>
        <p className="text-red-500">{t('failed to load data')}</p>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('order summary')}</h1>
      <OrderList orders={data.orders} totalPages={data.totalPages} page={page} />
    </div>
  );
}