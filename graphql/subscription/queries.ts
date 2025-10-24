// /home/mark/Music/my-nextjs-project-clean/graphql/subscription/queries.ts
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

export const GET_SELLER_SUBSCRIPTION = gql`
  query SellerSubscription($userId: ID!) {
    sellerSubscription(userId: $userId) {
      planId
      status
      startDate
      endDate
      pointsBalance
    }
  }
`;

export const GET_PAYMENT_METHODS = gql`
  query PaymentMethods($userId: ID!) {
    paymentMethods(userId: $userId) {
      id
      providerName
    }
  }
`;