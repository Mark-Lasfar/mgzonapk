import { gql } from '@apollo/client';

export const SYNC_CAMPAIGN_METRICS = gql`
  mutation SyncCampaignMetrics($campaignId: ID!, $sandbox: Boolean!) {
    syncCampaignMetrics(campaignId: $campaignId, sandbox: $sandbox) {
      metrics {
        impressions
        clicks
        conversions
        spend
      }
    }
  }
`;

export const DELETE_CAMPAIGN = gql`
  mutation DeleteCampaign($campaignId: ID!, $sandbox: Boolean!) {
    deleteCampaign(campaignId: $campaignId, sandbox: $sandbox)
  }
`;

export const CREATE_CAMPAIGN = gql`
  mutation CreateCampaign($input: CampaignInput!) {
    createCampaign(input: $input) {
      _id
      providerName
      name
      status
      budget {
        amount
        currency
      }
      schedule {
        startDate
        endDate
      }
      metrics {
        impressions
        clicks
        conversions
        spend
      }
      targeting
      creatives {
        type
        url
        metadata
      }
      products
    }
  }
`;

export const UPDATE_CAMPAIGN = gql`
  mutation UpdateCampaign($id: ID!, $input: CampaignInput!) {
    updateCampaign(id: $id, input: $input) {
      _id
      providerName
      name
      status
      budget {
        amount
        currency
      }
      schedule {
        startDate
        endDate
      }
      metrics {
        impressions
        clicks
        conversions
        spend
      }
      targeting
      creatives {
        type
        url
        metadata
      }
      products
    }
  }
`;