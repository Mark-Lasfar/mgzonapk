// /home/mark/Music/my-nextjs-project-clean/graphql/subscription/mutations.ts
import { gql } from '@apollo/client';

export const REDEEM_SUBSCRIPTION_POINTS = gql`
  mutation RedeemSubscriptionPoints($input: SubscriptionInput!) {
    redeemSubscriptionPoints(input: $input) {
      success
      message
      data {
        planId
        status
        startDate
        endDate
        pointsBalance
      }
    }
  }
`;

export const UPDATE_SUBSCRIPTION = gql`
  mutation UpdateSubscription($input: SubscriptionInput!) {
    updateSubscription(input: $input) {
      success
      message
      data {
        planId
        status
        startDate
        endDate
        pointsBalance
      }
    }
  }
`;