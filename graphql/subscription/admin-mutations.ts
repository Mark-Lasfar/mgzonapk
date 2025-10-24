// /home/mark/Music/my-nextjs-project-clean/graphql/subscription/admin-mutations.ts
import { gql } from '@apollo/client';

export const CREATE_SUBSCRIPTION_PLAN = gql`
  mutation CreateSubscriptionPlan($input: SubscriptionPlanInput!) {
    createSubscriptionPlan(input: $input) {
      success
      message
      data {
        id
        name
        price
        pointsCost
        currency
        description
        features {
          productsLimit
          commission
          prioritySupport
          instantPayouts
          customSectionsLimit
          domainSupport
          domainRenewal
          pointsRedeemable
          dynamicPaymentGateways
          maxApiKeys
          analyticsAccess
          abTesting
        }
        isTrial
        trialDuration
        isActive
      }
    }
  }
`;

export const UPDATE_SUBSCRIPTION_PLAN = gql`
  mutation UpdateSubscriptionPlan($input: SubscriptionPlanInput!) {
    updateSubscriptionPlan(input: $input) {
      success
      message
      data {
        id
        name
        price
        pointsCost
        currency
        description
        features {
          productsLimit
          commission
          prioritySupport
          instantPayouts
          customSectionsLimit
          domainSupport
          domainRenewal
          pointsRedeemable
          dynamicPaymentGateways
          maxApiKeys
          analyticsAccess
          abTesting
        }
        isTrial
        trialDuration
        isActive
      }
    }
  }
`;

export const DELETE_SUBSCRIPTION_PLAN = gql`
  mutation DeleteSubscriptionPlan($id: ID!) {
    deleteSubscriptionPlan(id: $id) {
      success
      message
    }
  }
`;