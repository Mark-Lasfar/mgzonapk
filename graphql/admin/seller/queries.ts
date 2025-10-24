import { gql } from '@apollo/client';

export const GET_SELLER = gql`
  query GetSeller($sellerId: ID!) {
    seller(sellerId: $sellerId) {
      _id
      userId
      businessName
      email
      phone
      description
      logo
      subscription {
        planId
        status
        startDate
        endDate
        pointsBalance
      }
      status
      suspended
      suspendReason
      metrics {
        totalSales
        totalOrders
        revenue {
          monthly
          yearly
        }
        analytics {
          visitorsCount
          pageViews
        }
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_SELLERS_LIST = gql`
  query GetSellers($page: Int!, $limit: Int!, $search: String) {
    sellers(page: $page, limit: $limit, search: $search) {
      sellers {
        _id
        userId
        businessName
        email
        phone
        subscription {
          planId
          status
        }
        status
        suspended
        suspendReason
      }
      pagination {
        total
        pages
        current
        pageSize
      }
    }
  }
`;

export const GET_SELLER_METRICS = gql`
  query GetSellerMetrics($sellerId: ID!) {
    sellerMetrics(sellerId: $sellerId) {
      totalSales
      totalOrders
      revenue {
        monthly
        yearly
      }
      analytics {
        visitorsCount
        pageViews
      }
    }
  }
`;