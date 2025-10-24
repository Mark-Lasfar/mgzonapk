'use client';

import { useQuery } from '@apollo/client/react';
import { GET_SELLER, GET_SELLER_METRICS } from '@/graphql/admin/seller/queries';
import SellerEditForm from './seller-edit-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

interface SellerDetailClientProps {
  sellerId: string;
  locale: string;
}

export default function SellerDetailClient({ sellerId, locale }: SellerDetailClientProps) {
  const t = useTranslations('Admin.sellers');
  
  const { data: sellerData, loading: sellerLoading } = useQuery(GET_SELLER, {
    variables: { sellerId }
  });

  const { data: metricsData, loading: metricsLoading } = useQuery(GET_SELLER_METRICS, {
    variables: { sellerId }
  });

  if (sellerLoading || metricsLoading) {
    return <div className="container mx-auto p-8">Loading...</div>;
  }

  const seller = sellerData?.seller;

  if (!seller) {
    return <div className="container mx-auto p-8">Seller not found</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">{t('sellerDetails')}: {seller.businessName}</h1>

      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('businessInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {seller.logo && (
            <Image 
              src={seller.logo} 
              alt="Seller Logo" 
              width={100} 
              height={100} 
              className="rounded" 
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <p><strong>{t('email')}:</strong> {seller.email}</p>
            <p><strong>{t('phone')}:</strong> {seller.phone}</p>
            <p><strong>{t('status')}:</strong> {seller.status}</p>
            <p><strong>{t('subscription')}:</strong> {seller.subscription?.status || 'trial'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('metrics')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <strong>{t('totalSales')}:</strong> ${metricsData?.sellerMetrics?.revenue?.yearly?.toFixed(2) || 0}
            </div>
            <div>
              <strong>{t('totalOrders')}:</strong> {metricsData?.sellerMetrics?.totalOrders || 0}
            </div>
            <div>
              <strong>{t('visitors')}:</strong> {metricsData?.sellerMetrics?.analytics?.visitorsCount || 0}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <SellerEditForm seller={seller} />
    </div>
  );
}