// /home/mark/Music/my-nextjs-project-clean/graphql/subscription/admin-queries.ts
import { gql } from '@apollo/client';

export const GET_SUBSCRIPTION_PLANS = gql`
  query SubscriptionPlans {
    subscriptionPlans {
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
`;