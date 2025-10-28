'use client';

import AdsDetails from '@/components/seller/ads/AdsDetails';

export default function CampaignDetailsPage({ params }: { params: { id: string } }) {
  return <AdsDetails campaignId={params.id} />;
}