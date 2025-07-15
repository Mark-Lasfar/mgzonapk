import SubscriptionPlanModel from '@/lib/db/models/subscription-plan.model';
import { connectToDatabase } from '@/lib/db';

export const SENDER_NAME = process.env.SENDER_NAME || 'support';
export const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

export const USER_ROLES = ['admin', 'user', 'SELLER'] as const;
export const COLORS = ['Gold', 'Blue', 'Red'] as const;
export const THEMES = ['default', 'dark', 'light'] as const;

export interface SubscriptionPlan {
  id: string;
  name: string; // أزلت الـ enum لدعم الاشتراكات الديناميكية عشان الادمن هو اللي هيضيف الاشتراكات من لوحه التحكم 
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
    pointsRedeemable: boolean;
    dynamicPaymentGateways: boolean;
    maxApiKeys: number;
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
      maxApiKeys: plan.features.maxApiKeys || 1,
    },
    isTrial: plan.isTrial,
    trialDuration: plan.trialDuration,
    isActive: plan.isActive,
  }));
}