'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Edit } from 'lucide-react';
import Sidebar from '@/components/ui/Sidebar';
// import Sidebar from '@/components/Sidebar';

interface AdCampaign {
  _id: string;
  providerName: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  budget: { amount: number; currency: string };
  schedule: { startDate: string; endDate?: string };
  metrics: { impressions: number; clicks: number; conversions: number; spend: number };
  targeting?: Record<string, any>;
  creatives: { type: 'image' | 'video' | 'text'; url: string; metadata?: Record<string, any> }[];
}

export default function CampaignDetailsPage({ params }: { params: { id: string } }) {
  const t = useTranslations('Ads');
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<AdCampaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const abortController = new AbortController();
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [campaignRes, notificationsRes] = await Promise.all([
          fetch(`/api/seller/ads?campaignId=${params.id}`, { signal: abortController.signal }),
          fetch(`/api/seller/notifications?limit=5`, { signal: abortController.signal }),
        ]);
        if (!campaignRes.ok || !notificationsRes.ok) {
          const errorData = await (campaignRes.ok ? notificationsRes : campaignRes).json();
          throw new Error(errorData.message || t('Error.Message'));
        }
        const { data: campaignData } = await campaignRes.json();
        const { data: notificationsData } = await notificationsRes.json();
        setCampaign(campaignData);
        setNotifications(notificationsData);
      } catch (error: any) {
        if (error.name === 'AbortError') return;
        toast({ variant: 'destructive', title: t('Error.Title'), description: error.message || t('Error.Message') });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
    return () => abortController.abort();
  }, [params.id, t]);

  if (isLoading) {
    return (
      <div className="flex">
        <Sidebar notifications={notifications} />
        <div className="flex-1 container mx-auto p-6">
          <p>{t('Loading')}</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex">
        <Sidebar notifications={notifications} />
        <div className="flex-1 container mx-auto p-6">
          <p>{t('Error.Campaign Not Found')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex">
      <Sidebar notifications={notifications} />
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
                ```chartjs
                {
                  type: 'bar',
                  data: {
                    labels: ['Impressions', 'Clicks', 'Conversions'],
                    datasets: [{
                      label: 'Campaign Metrics',
                      data: [
                        campaign.metrics.impressions,
                        campaign.metrics.clicks,
                        campaign.metrics.conversions
                      ],
                      backgroundColor: ['#3b82f6', '#10b981', '#ef4444'],
                      borderColor: ['#1e40af', '#047857', '#b91c1c'],
                      borderWidth: 1
                    }]
                  },
                  options: {
                    scales: {
                      y: {
                        beginAtZero: true
                      }
                    },
                    plugins: {
                      legend: {
                        display: true
                      }
                    }
                  }
                }
                ```
              </div>
              <div>
                <h3 className="font-semibold">{t('Creatives')}</h3>
                {campaign.creatives.map((creative, index) => (
                  <div key={index} className="flex items-center space-x-2 mb-2">
                    <p>{t(creative.type.charAt(0).toUpperCase() + creative.type.slice(1))}: <a href={creative.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">{creative.url}</a></p>
                    {creative.type === 'image' && <img src={creative.url} alt="Creative" className="w-32 h-24 object-cover rounded" />}
                    {creative.type === 'video' && (
                      <video src={creative.url} controls className="w-32 h-24 object-cover rounded" />
                    )}
                  </div>
                ))}
              </div>
              {campaign.targeting && (
                <div>
                  <h3 className="font-semibold">{t('Targeting')}</h3>
                  <pre>{JSON.stringify(campaign.targeting, null, 2)}</pre>
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