import SubscriptionPlanModel from '@/lib/db/models/subscription-plan.model';
import { connectToDatabase } from '@/lib/db';

export const SENDER_NAME = process.env.SENDER_NAME || 'support';
export const SENDER_EMAIL = process.env.SENDER_EMAIL || 'marklasfar@gmail.com';

export const USER_ROLES = ['Admin', 'user', 'SELLER'] as const;
export const COLORS = ['Gold', 'Blue', 'Red'] as const;
export const THEMES = ['default', 'dark', 'light'] as const;

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  pointsCost: number;
  description: string;
  features: {
    productsLimit: number;
    commission: number;
    prioritySupport: boolean;
    instantPayouts: boolean;
    customSectionsLimit: number;
    domainSupport: boolean;
    domainRenewal: boolean;
    analyticsAccess:boolean;
    pointsRedeemable: boolean;
    dynamicPaymentGateways: boolean;
    maxApiKeys: number;
    abTesting: boolean;
  };
  isTrial?: boolean;
  trialDuration?: number;
  isActive: boolean;
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  await connectToDatabase();
  const plans = await SubscriptionPlanModel.find({ isActive: true }).lean();
  return plans.map((plan) => ({
    id: plan._id.toString(),
    name: plan.name,
    price: plan.price,
    pointsCost: plan.pointsCost,
    description: plan.description,
    features: {
      productsLimit: plan.features.productsLimit,
      commission: plan.features.commission,
      prioritySupport: plan.features.prioritySupport,
      instantPayouts: plan.features.instantPayouts,
      customSectionsLimit: plan.features.customSectionsLimit,
      domainSupport: plan.features.domainSupport,
      domainRenewal: plan.features.domainRenewal,
      pointsRedeemable: plan.features.pointsRedeemable,
      dynamicPaymentGateways: plan.features.dynamicPaymentGateways,
      analyticsAccess: plan.features.analyticsAccess,
      abTesting: plan.features.abTesting,
      maxApiKeys: plan.features.maxApiKeys || 1,


    },
    isTrial: plan.isTrial,
    trialDuration: plan.trialDuration,
    isActive: plan.isActive,
  }));
}