import { gql } from '@apollo/client';

export const UPDATE_SELLER = gql`
  mutation UpdateSeller($sellerId: ID!, $input: SellerInput!) {
    updateSeller(sellerId: $sellerId, input: $input) {
      success
      message
      data {
        _id
        userId
        businessName
        email
        phone
        description
        logo
      }
      error
    }
  }
`;

export const SUSPEND_SELLER = gql`
  mutation SuspendSeller($input: SuspendSellerInput!) {
    suspendSeller(input: $input) {
      success
      message
      data {
        _id
        status
        suspended
        suspendReason
      }
      error
    }
  }
`;

export const DELETE_SELLER = gql`
  mutation DeleteSeller($input: DeleteSellerInput!) {
    deleteSeller(input: $input) {
      success
      message
      error
    }
  }
`;

export const UNSUSPEND_SELLER = gql`
  mutation UnsuspendSeller($sellerId: ID!) {
    unsuspendSeller(sellerId: $sellerId) {
      success
      message
      data {
        _id
        status
        suspended
      }
      error
    }
  }
`;