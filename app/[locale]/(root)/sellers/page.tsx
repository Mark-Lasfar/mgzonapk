import { auth } from '@/auth';
import { getAllSellers } from '@/lib/actions/seller.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslations } from 'next-intl';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'admin.sellers.title',
};

export default async function SellersPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { page?: string; search?: string; status?: string };
}) {
  const t = await useTranslations('Sellers');
  const session = await auth();
  if (!session?.user || session.user.role !== 'Admin') {
    redirect('/sign-in');
  }

  const page = parseInt(searchParams.page || '1', 10);
  const search = searchParams.search || '';
  const status = searchParams.status as 'active' | 'expired' | 'cancelled' | 'pending' | 'suspended' | undefined;

  const sellersResult = await getAllSellers(
    { page, limit: 10, search, status, sortBy: 'createdAt', sortOrder: 'desc' },
    locale
  );

  if (!sellersResult.success) {
    return <div>{t('error', { defaultMessage: 'Failed to load sellers' })}</div>;
  }

  const { sellers, pagination } = sellersResult.data;

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="h1-bold py-4">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('manageSellers')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="mb-4 flex gap-4">
            <Input
              name="search"
              placeholder={t('searchPlaceholder')}
              defaultValue={search}
              className="max-w-sm"
            />
            <Button type="submit">{t('search')}</Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('businessName')}</TableHead>
                <TableHead>{t('email')}</TableHead>
                <TableHead>{t('subscriptionPlan')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller) => (
                <TableRow key={seller._id}>
                  <TableCell>{seller.businessName}</TableCell>
                  <TableCell>{seller.email}</TableCell>
                  <TableCell>{seller.subscription.plan}</TableCell>
                  <TableCell>{seller.subscription.status}</TableCell>
                  <TableCell>
                    <Link href={`/${locale}/${seller.customSiteUrl}`}>
                      <Button variant="outline">{t('view')}</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-between">
            <p>
              {t('showing', {
                start: (pagination.page - 1) * pagination.limit + 1,
                end: Math.min(pagination.page * pagination.limit, pagination.total),
                total: pagination.total,
              })}
            </p>
            <div className="flex gap-2">
              {pagination.page > 1 && (
                <Link href={`?page=${pagination.page - 1}&search=${search}`}>
                  <Button>{t('previous')}</Button>
                </Link>
              )}
              {pagination.page < pagination.pages && (
                <Link href={`?page=${pagination.page + 1}&search=${search}`}>
                  <Button>{t('next')}</Button>
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}