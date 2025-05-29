export interface SubscriptionPlan {
    id: number
    name: string
    price: number
    pointsCost: number
    description: string
    features: {
      productsLimit: number | typeof Infinity
      commission: number
      prioritySupport: boolean
      instantPayouts: boolean
    }
  }
  
  export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
    {
      id: 1,
      name: 'Basic Plan',
      price: 10,
      pointsCost: 200, // 200 points = $10
      description: 'Access to basic features, 100 product limit, 5% commission.',
      features: { productsLimit: 100, commission: 5, prioritySupport: false, instantPayouts: false },
    },
    {
      id: 2,
      name: 'Pro Plan',
      price: 30,
      pointsCost: 600, // 600 points = $30
      description: 'Access to premium features, 500 product limit, 3% commission, priority support.',
      features: { productsLimit: 500, commission: 3, prioritySupport: true, instantPayouts: false },
    },
    {
      id: 3,
      name: 'VIP Plan',
      price: 100,
      pointsCost: 2000, // 2000 points = $100
      description: 'Customized solutions, unlimited products, 1% commission, priority support, instant payouts.',
      features: { productsLimit: Infinity, commission: 1, prioritySupport: true, instantPayouts: true },
    },
  ]