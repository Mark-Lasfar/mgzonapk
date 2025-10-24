import { gql } from '@apollo/client';

export const GET_CAMPAIGN = gql`
  query GetCampaign($campaignId: ID!) {
    campaign(id: $campaignId) {
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
      integrationId
    }
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications($limit: Int!) {
    notifications(limit: $limit) {
      _id
      message
      read
      createdAt
    }
  }
`;

export const GET_CAMPAIGNS = gql`
  query GetCampaigns($sellerId: ID!, $sandbox: Boolean!, $status: String, $search: String, $page: Int!, $limit: Int!) {
    campaigns(sellerId: $sellerId, sandbox: $sandbox, status: $status, search: $search, page: $page, limit: $limit) {
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