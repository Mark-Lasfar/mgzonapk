// graphql/seller/mutations.ts

import { gql } from '@apollo/client';

export const UPDATE_SELLER_CONFIGURATIONS = gql`
  mutation UpdateSellerConfigurations($sellerId: ID!, $input: SellerConfigurationsInput!) {
    updateSellerConfigurations(sellerId: $sellerId, input: $input) {
      categories
      productStatuses
      dynamicSources
      layouts
    }
  }
`;

export const ADD_INTEGRATION = gql`
  mutation AddIntegration($sellerId: ID!, $input: IntegrationInput!) {
    addIntegration(sellerId: $sellerId, input: $input) {
      _id
      type
      providerName
      status
      settings
      logoUrl
    }
  }
`;

export const SellerConfigurationsInput = gql`
  input SellerConfigurationsInput {
    categories: [String!]!
    productStatuses: [String!]!
    dynamicSources: [String!]!
    layouts: [String!]!
  }
`;

export const IntegrationInput = gql`
  input IntegrationInput {
    type: String!
    providerName: String!
    status: String!
    settings: JSON
    logoUrl: String
  }
`;

export const ACTIVATE_INTEGRATION = gql`
  mutation ActivateIntegration($sellerId: ID!, $integrationId: ID!, $sandboxMode: Boolean!) {
    activateIntegration(sellerId: $sellerId, integrationId: $integrationId, sandboxMode: $sandboxMode) {
      id
      name
      provider
      location
      logoUrl
    }
  }
`;