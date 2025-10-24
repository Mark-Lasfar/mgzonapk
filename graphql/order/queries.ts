// /graphql/order/queries.ts
import { gql } from '@apollo/client';

export const GET_ORDERS = gql`
  query GetOrders($sellerId: ID!) {
    orders(sellerId: $sellerId) {
      id
      productId
      status
      trackingNumber
      trackingUrl
      supplierId
      createdAt
    }
  }
`;

export const UPDATE_ORDER_STATUS = gql`
  mutation UpdateOrderStatus($orderId: ID!, $status: String!) {
    updateOrderStatus(orderId: $orderId, status: $status) {
      id
      status
    }
  }
`;