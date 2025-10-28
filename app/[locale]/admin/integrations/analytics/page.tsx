'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { useTranslations } from 'next-intl';

interface AnalyticsData {
  providerName: string;
  type: string;
  connectedSellers: number;
  successRate: number;
  failureCount: number;
  lastSync: string;
}

export default function IntegrationsAnalyticsPage() {
  const t = useTranslations('Admin Integrations Analytics');
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/integrations/analytics');
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }
        const { data } = await response.json();
        setAnalytics(data);
      } catch (error) {
        toast({
          title: t('error'),
          description: t('fetchFailed'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalytics();
  }, [t, toast]);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      {isLoading ? (
        <p>{t('loading')}</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {analytics.map((item) => (
            <Card key={item.providerName}>
              <CardHeader>
                <CardTitle>{item.providerName}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{t('type')}: {t(item.type)}</p>
                <p>{t('connectedSellers')}: {item.connectedSellers}</p>
                <p>{t('successRate')}: {(item.successRate * 100).toFixed(2)}%</p>
                <p>{t('failureCount')}: {item.failureCount}</p>
                <p>{t('lastSync')}: {item.lastSync ? new Date(item.lastSync).toLocaleDateString() : t('never')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}