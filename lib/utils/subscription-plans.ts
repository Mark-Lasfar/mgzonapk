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
    };
    isTrial?: boolean;
    trialDuration?: number;
  }
  
  export const subscriptionPlans: SubscriptionPlan[] = [
    {
      id: 'trial',
      name: 'trial',
      price: 1,
      pointsCost: 20,
      description: 'free plan for new sellers, $1/month for first 3 months.',
      features: { productsLimit: 50, commission: 7, prioritySupport: false, instantPayouts: false },
      isTrial: true,
      trialDuration: 3,
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 10,
      pointsCost: 200,
      description: 'Access to basic features, 100 product limit, 5% commission.',
      features: { productsLimit: 100, commission: 5, prioritySupport: false, instantPayouts: false },
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 30,
      pointsCost: 600,
      description: 'Access to premium features, 500 product limit, 3% commission, priority support.',
      features: { productsLimit: 500, commission: 3, prioritySupport: true, instantPayouts: false },
    },
    {
      id: 'vip',
      name: 'VIP',
      price: 100,
      pointsCost: 2000,
      description: 'Customized solutions, unlimited products, 1% commission, priority support, instant payouts.',
      features: { productsLimit: Infinity, commission: 1, prioritySupport: true, instantPayouts: true },
    },
  ];