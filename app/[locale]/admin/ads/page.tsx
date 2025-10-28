'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { Trash2 } from 'lucide-react';

interface AdCampaign {
  _id: string;
  sellerId: string;
  providerName: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  budget: { amount: number; currency: string };
  schedule: { startDate: string; endDate?: string };
  metrics: { impressions: number; clicks: number; conversions: number; spend: number };
}

export default function AdminAdsPage() {
  const t = useTranslations('admin.ads');
  const router = useRouter();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/admin/ads?status=${filterStatus !== 'all' ? filterStatus : ''}&search=${searchQuery}`);
        if (!response.ok) throw new Error('Failed to fetch campaigns');
        const { data } = await response.json();
        setCampaigns(data);
      } catch (error) {
        toast({ variant: 'destructive', title: t('errorTitle'), description: String(error) });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCampaigns();
  }, [filterStatus, searchQuery, t]);

  const handleDelete = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/admin/ads?campaignId=${campaignId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete campaign');
      setCampaigns(campaigns.filter((c) => c._id !== campaignId));
      toast({ title: t('successTitle'), description: t('deleted') });
    } catch (error) {
      toast({ variant: 'destructive', title: t('errorTitle'), description: String(error) });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <div className="flex gap-4 mb-6">
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select onValueChange={setFilterStatus} defaultValue="all">
          <SelectTrigger>
            <SelectValue placeholder={t('filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('all')}</SelectItem>
            <SelectItem value="draft">{t('draft')}</SelectItem>
            <SelectItem value="active">{t('active')}</SelectItem>
            <SelectItem value="paused">{t('paused')}</SelectItem>
            <SelectItem value="completed">{t('completed')}</SelectItem>
            <SelectItem value="failed">{t('failed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <p>{t('loading')}</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('campaigns')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('provider')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('budget')}</TableHead>
                  <TableHead>{t('impressions')}</TableHead>
                  <TableHead>{t('clicks')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign._id}>
                    <TableCell>{campaign.name}</TableCell>
                    <TableCell>{campaign.providerName}</TableCell>
                    <TableCell>{t(campaign.status)}</TableCell>
                    <TableCell>{`${campaign.budget.amount} ${campaign.budget.currency}`}</TableCell>
                    <TableCell>{campaign.metrics.impressions}</TableCell>
                    <TableCell>{campaign.metrics.clicks}</TableCell>
                    <TableCell>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(campaign._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}