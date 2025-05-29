export const SUBSCRIPTION_PLANS = [
    {
      name: 'Basic',
      price: 10,
      pointsCost: 200,
      description: 'Access to basic features, 100 product limit, 5% commission.',
      features: {
        productsLimit: 100,
        commission: 5,
        prioritySupport: false,
        instantPayouts: false,
      },
    },
    {
      name: 'Pro',
      price: 30,
      pointsCost: 600,
      description: 'Access to premium features, 500 product limit, 3% commission, priority support.',
      features: {
        productsLimit: 500,
        commission: 3,
        prioritySupport: true,
        instantPayouts: false,
      },
    },
    {
      name: 'VIP',
      price: 100,
      pointsCost: 2000,
      description: 'Customized solutions, unlimited products, 1% commission, priority support, instant payouts.',
      features: {
        productsLimit: Infinity,
        commission: 1,
        prioritySupport: true,
        instantPayouts: true,
      },
    },
  ] as const