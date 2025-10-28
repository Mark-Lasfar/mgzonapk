'use client';

import AdsEditForm from '@/components/seller/ads/AdsEditForm';

export default function CampaignEditPage({ params }: { params: { id: string } }) {
  return <AdsEditForm campaignId={params.id} />;
}