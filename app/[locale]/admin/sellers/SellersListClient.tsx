'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@apollo/client/react';
import { GET_SELLERS_LIST } from '@/graphql/admin/seller/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

const PAGE_SIZE = 10;

export default function SellersListClient({
  initialSearch,
  initialPage,
  locale
}: {
  initialSearch: string;
  initialPage: number;
  locale: string;
}) {
  const t = useTranslations('Admin.sellers');
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);

  const { data, loading, refetch } = useQuery(GET_SELLERS_LIST, {
    variables: {
      page,
      limit: PAGE_SIZE,
      search: search || undefined
    }
  });

  const sellers = data?.sellers?.sellers || [];
  const pagination = data?.sellers?.pagination;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refetch({ page: 1, limit: PAGE_SIZE, search });
    router.push(`/${locale}/admin/sellers?search=${search}&page=1`);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    refetch({ page: newPage, limit: PAGE_SIZE, search });
    router.push(`/${locale}/admin/sellers?search=${search}&page=${newPage}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button type="submit">{t('search')}</Button>
          </form>

          {/* Sellers Table */}
          {sellers.length === 0 ? (
            <p>{t('noSellers')}</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-4 py-2 text-left">{t('businessName')}</th>
                      <th className="border px-4 py-2 text-left">{t('email')}</th>
                      <th className="border px-4 py-2 text-left">{t('subscriptionPlan')}</th>
                      <th className="border px-4 py-2 text-left">{t('status')}</th>
                      <th className="border px-4 py-2 text-left">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((seller: any) => (
                      <tr key={seller._id} className="hover:bg-gray-50">
                        <td className="border px-4 py-2">{seller.businessName}</td>
                        <td className="border px-4 py-2">{seller.email}</td>
                        <td className="border px-4 py-2">{seller.subscription?.status || 'trial'}</td>
                        <td className="border px-4 py-2">
                          <span className={`px-2 py-1 rounded ${
                            seller.suspended ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {seller.status}
                          </span>
                        </td>
                        <td className="border px-4 py-2">
                          <Link
                            href={`/${locale}/admin/sellers/${seller._id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {t('view')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && (
                <div className="flex justify-between items-center mt-4">
                  <p>
                    {t('showing', { 
                      start: (page - 1) * PAGE_SIZE + 1, 
                      end: Math.min(page * PAGE_SIZE, pagination.total), 
                      total: pagination.total 
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1}
                    >
                      {t('previous')}
                    </Button>
                    <span>{t('page', { page, total: pagination.pages })}</span>
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === pagination.pages}
                    >
                      {t('next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}