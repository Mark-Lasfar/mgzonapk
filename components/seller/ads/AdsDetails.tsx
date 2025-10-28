'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { ArrowLeft, Edit } from 'lucide-react';
import Sidebar from '@/components/ui/Sidebar';
import { GET_CAMPAIGN, GET_NOTIFICATIONS } from '@/graphql/ads/queries';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface Creative {
  type: 'image' | 'video' | 'text';
  url: string;
  metadata?: Record<string, any>;
}

interface Budget {
  amount: number;
  currency: string;
}

interface Schedule {
  startDate: string;
  endDate?: string;
}

interface Metrics {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
}

interface AdCampaign {
  _id: string;
  providerName: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  budget: Budget;
  schedule: Schedule;
  metrics: Metrics;
  targeting?: Record<string, any>;
  creatives: Creative[];
  integrationId: string;
}

interface Notification {
  _id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface CampaignQueryData {
  campaign: AdCampaign;
}

interface NotificationsQueryData {
  notifications: Notification[];
}

export default function AdsDetails({ campaignId }: { campaignId: string }) {
  const t = useTranslations('Ads');
  const router = useRouter();
  const { toast } = useToast();

  const { data: campaignData, loading: campaignLoading, error: campaignError } = useQuery<CampaignQueryData>(GET_CAMPAIGN, {
    variables: { id: campaignId },
  });
  const { data: notificationsData, loading: notificationsLoading } = useQuery<NotificationsQueryData>(GET_NOTIFICATIONS, {
    variables: { limit: 5 },
  });

  if (campaignLoading || notificationsLoading) {
    return (
      <div className="flex">
        <Sidebar notifications={notificationsData?.notifications || []} />
        <div className="flex-1 container mx-auto p-6">
          <p>{t('Loading')}</p>
        </div>
      </div>
    );
  }

  if (campaignError || !campaignData?.campaign) {
    toast({ variant: 'destructive', title: t('Error.Title'), description: t('Error.Campaign Not Found') });
    return (
      <div className="flex">
        <Sidebar notifications={notificationsData?.notifications || []} />
        <div className="flex-1 container mx-auto p-6">
          <p>{t('Error.Campaign Not Found')}</p>
        </div>
      </div>
    );
  }

  const campaign = campaignData.campaign;

  const chartData = {
    labels: [t('Impressions'), t('Clicks'), t('Conversions')],
    datasets: [
      {
        label: t('Campaign Metrics'),
        data: [campaign.metrics.impressions, campaign.metrics.clicks, campaign.metrics.conversions],
        backgroundColor: ['#3b82f6', '#10b981', '#ef4444'],
        borderColor: ['#1e40af', '#047857', '#b91c1c'],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    scales: {
      y: {
        beginAtZero: true,
      },
    },
    plugins: {
      legend: {
        display: true,
      },
    },
  };

  return (
    <div className="flex">
      <Sidebar notifications={notificationsData?.notifications || []} />
      <div className="flex-1 container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{t('Campaign Details')}</h1>
          <Button onClick={() => router.push('/seller/dashboard/ads')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> {t('Back to Campaigns')}
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{campaign.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{t('Provider')}</h3>
                <p>{campaign.providerName}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('Status')}</h3>
                <p>{t(campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1))}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('Budget')}</h3>
                <p>{`${campaign.budget.amount} ${campaign.budget.currency}`}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('Schedule')}</h3>
                <p>
                  {t('Start Date')}: {new Date(campaign.schedule.startDate).toLocaleString()}
                </p>
                {campaign.schedule.endDate && (
                  <p>
                    {t('End Date')}: {new Date(campaign.schedule.endDate).toLocaleString()}
                  </p>
                )}
              </div>
              <div>
                <h3 className="font-semibold">{t('Metrics')}</h3>
                <p>{t('Impressions')}: {campaign.metrics.impressions}</p>
                <p>{t('Clicks')}: {campaign.metrics.clicks}</p>
                <p>{t('Conversions')}: {campaign.metrics.conversions}</p>
                <p>{t('Spend')}: {campaign.metrics.spend} {campaign.budget.currency}</p>
              </div>
              <div>
                <h3 className="font-semibold">{t('Metrics Chart')}</h3>
                <div className="h-64">
                  <Bar data={chartData} options={chartOptions} />
                </div>
              </div>
              <div>
                <h3 className="font-semibold">{t('Creatives')}</h3>
                {campaign.creatives.map((creative: Creative, index: number) => (
                  <div key={index} className="mb-2">
                    <p>
                      {t(creative.type.charAt(0).toUpperCase() + creative.type.slice(1))}: {creative.url}
                    </p>
                    {creative.type === 'image' && (
                      <img src={creative.url} alt="Creative" className="w-32 h-24 object-cover rounded" />
                    )}
                    {creative.type === 'video' && (
                      <video src={creative.url} controls className="w-32 h-24 object-cover rounded" />
                    )}
                  </div>
                ))}
              </div>
              {campaign.targeting && (
                <div>
                  <h3 className="font-semibold">{t('Targeting')}</h3>
                  <pre className="bg-gray-100 p-2 rounded">{JSON.stringify(campaign.targeting, null, 2)}</pre>
                </div>
              )}
              <Button onClick={() => router.push(`/seller/dashboard/ads/${campaign._id}/edit`)}>
                <Edit className="h-4 w-4 mr-2" /> {t('Edit Campaign')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}