// /home/mark/Music/my-nextjs-project-clean/app/[locale]/(root)/seller/dashboard/analytics/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface AnalyticsData {
  metric: string;
  value: number;
  date: string;
}

export default function AnalyticsPage() {
  const t = useTranslations('seller.dashboard.analytics');
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<AnalyticsData[]>([]);
  const [metricType, setMetricType] = useState('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/seller/analytics?metric=${metricType}&startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) throw new Error(t('Fetch Error'));
        const { data } = await response.json();
        setMetrics(data);
      } catch (error) {
        toast({ variant: 'destructive', title: t('Error Title'), description: String(error) });
      } finally {
        setIsLoading(false);
      }
    };
    if (startDate && endDate) {
      fetchMetrics();
    }
  }, [metricType, startDate, endDate, t]);

  const handleFetchMetrics = () => {
    if (!startDate || !endDate) {
      toast({ variant: 'destructive', title: t('Error Title'), description: t('Date Required') });
      return;
    }
    // Trigger useEffect by updating state
    setMetricType(metricType);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('Analytics Title')}</h1>
      <div className="flex gap-4 mb-6">
        <Select onValueChange={setMetricType} defaultValue="sales">
          <SelectTrigger>
            <SelectValue placeholder={t('Metric Type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sales">{t('Sales')}</SelectItem>
            <SelectItem value="views">{t('Views')}</SelectItem>
            <SelectItem value="conversions">{t('Conversions')}</SelectItem>
            <SelectItem value="returns">{t('Returns')}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          placeholder={t('Start Date')}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          type="date"
          placeholder={t('End Date')}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Button onClick={handleFetchMetrics}>{t('Fetch Metrics')}</Button>
      </div>
      {isLoading ? (
        <p>{t('Loading')}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t(`${metricType} Chart`)}</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart width={800} height={400} data={metrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#8884d8" />
            </LineChart>
          </CardContent>
        </Card>
      )}
    </div>
  );
}