import { useQuery, useMutation } from '@apollo/client';
import { GET_CAMPAIGNS } from '@/graphql/ads/queries';
import { SYNC_CAMPAIGN_METRICS } from '@/graphql/ads/mutations';
import { useToast } from '@/components/ui/toast';
import { useState } from 'react';

// Define interfaces for the GraphQL response shapes
interface Campaign {
  _id: string;
  providerName: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'failed';
  budget: { amount: number; currency: string };
  schedule: { startDate: string; endDate?: string };
  metrics: { impressions: number; clicks: number; conversions: number; spend: number };
  targeting?: Record<string, any>;
  creatives: { type: 'image' | 'video' | 'text'; url: string; metadata?: Record<string, any> }[];
  products?: string[];
}

interface CampaignsQuery {
  campaigns: {
    data: Campaign[];
    totalPages: number;
  };
}

interface SyncCampaignMetricsMutation {
  syncCampaignMetrics: {
    metrics: {
      impressions: number;
      clicks: number;
      conversions: number;
      spend: number;
    };
  };
}

interface CampaignsData {
  campaigns: Campaign[];
  totalPages: number;
}

export function useCampaigns(sellerId: string, sandbox: boolean, status: string, search: string, page: number, limit: number) {
  const { toast } = useToast();

  const { data, loading, error } = useQuery<CampaignsQuery, { sellerId: string; sandbox: boolean; status?: string; search: string; page: number; limit: number }>(
    GET_CAMPAIGNS,
    {
      variables: { sellerId, sandbox, status: status !== 'all' ? status : undefined, search, page, limit },
      onError: (error) => {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch campaigns' });
      },
    }
  );

  return {
    data: data
      ? {
          campaigns: data.campaigns.data || [],
          totalPages: data.campaigns.totalPages || 1,
        }
      : { campaigns: [], totalPages: 1 },
    loading,
    error,
  };
}

export function useSyncCampaignMetrics() {
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const { toast } = useToast();
  const [syncCampaignMetrics] = useMutation<SyncCampaignMetricsMutation, { campaignId: string; sandbox: boolean }>(SYNC_CAMPAIGN_METRICS);

  const handleSync = async (campaignId: string, sandbox: boolean) => {
    setIsSyncing(campaignId);
    try {
      const { data } = await syncCampaignMetrics({ variables: { campaignId, sandbox } });
      toast({ title: 'Success', description: 'Metrics synced successfully' });
      return data!.syncCampaignMetrics.metrics; // Use non-null assertion since data is guaranteed on success
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to sync metrics' });
      throw error;
    } finally {
      setIsSyncing(null);
    }
  };

  return { handleSync, isSyncing };
}