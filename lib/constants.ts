export const SENDER_NAME = process.env.SENDER_NAME || 'support';
export const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

export const USER_ROLES = ['Admin', 'User', 'SELLER'];
export const COLORS = ['Gold', 'Green', 'Red'];
export const THEMES = ['Light', 'Dark', 'System'];

export const subscriptionPlans = [
  {
    id: 'trial',
    name: 'Trial Plan',
    price: 1,
    pointsCost: 20, // 1 USD = 20 points
    description: 'Trial plan for new sellers, $1/month for first 3 months.',
    features: {
      productsLimit: 50,
      commission: 7,
      prioritySupport: false,
      instantPayouts: false,
      customSectionsLimit: 0, // No custom sections
    },
    isTrial: true,
    trialDuration: 3, // 3 months
  },
  {
    id: 'basic',
    name: 'Basic Plan',
    price: 10,
    pointsCost: 200,
    description: 'Access to basic features, 100 product limit, 5% commission.',
    features: {
      productsLimit: 100,
      commission: 5,
      prioritySupport: false,
      instantPayouts: false,
      customSectionsLimit: 0, // No custom sections
    },
  },
  {
    id: 'pro',
    name: 'Pro Plan',
    price: 30,
    pointsCost: 600,
    description: 'Access to premium features, 500 product limit, 3% commission, priority support.',
    features: {
      productsLimit: 500,
      commission: 3,
      prioritySupport: true,
      instantPayouts: false,
      customSectionsLimit: 1, // 1 custom section
    },
  },
  {
    id: 'vip',
    name: 'VIP Plan',
    price: 100,
    pointsCost: 2000,
    description: 'Customized solutions, unlimited products, 1% commission, priority support, instant payouts.',
    features: {
      productsLimit: Infinity,
      commission: 1,
      prioritySupport: true,
      instantPayouts: true,
      customSectionsLimit: 5, // Up to 5 custom sections
    },
  },
];