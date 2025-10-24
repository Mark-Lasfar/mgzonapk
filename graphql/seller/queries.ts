// graphql/seller/queries.ts


import { gql } from '@apollo/client';

export const GET_SELLER_CONFIGURATIONS = gql`
  query GetSellerConfigurations($sellerId: ID!) {
    sellerConfigurations(sellerId: $sellerId) {
      warehouses {
        id
        name
        provider
        location
        logoUrl
      }
      paymentMethods {
        id
        name
      }
      shippingProviders {
        id
        name
      }
      dropshippingProviders {
        id
        name
        provider
        location
        logoUrl
      }
    }
  }
`;

export const GET_INTEGRATIONS = gql`
  query GetIntegrations($sellerId: ID!, $sandboxMode: Boolean!) {
    integrations(sellerId: $sellerId, sandboxMode: $sandboxMode) {
      id
      name
      provider
      location
      logoUrl
    }
  }
`;

export const GET_SUPPLIERS = gql`
  query GetSuppliers($sellerId: ID!) {
    suppliers(sellerId: $sellerId) {
      id
      name
      address {
        street
        city
        state
        countryCode
        postalCode
      }
      contact {
        email
        phone
      }
      agreements {
        terms
        signedAt
      }
      type
      status
      estimatedDeliveryTime
    }
  }
`;


export const GET_SELLER_DATA = gql`
  query GetSellerData($sellerId: ID!, $sandboxMode: Boolean!, $notificationLimit: Int!) {
    integrations(sellerId: $sellerId, sandboxMode: $sandboxMode) {
      id
      providerName
      description
    }
    products(sellerId: $sellerId) {
      _id
      name
      currency
      availability
    }
    notifications(limit: $notificationLimit) {
      _id
      message
      read
      createdAt
    }
  }
`;