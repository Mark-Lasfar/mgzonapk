// /home/hager/new/my-nextjs-project-master (3)/my-nextjs-project-master/types/index.ts

import {
  CarouselSchema,
  CartSchema,
  DeliveryDateSchema,
  OrderInputSchema,
  OrderItemSchema,
  PaymentMethodSchema,
  ProductInputSchema,
  ReviewInputSchema,
  SettingInputSchema,
  ShippingAddressSchema,
  SiteCurrencySchema,
  SiteLanguageSchema,
  UserInputSchema,
  UserNameSchema,
  UserSignInSchema,
  UserSignUpSchema,
  WebPageInputSchema,
} from '@/lib/validator';
import { Types } from 'mongoose';
import { z } from 'zod';


// Base interfaces
export interface ISiteInfo {
  name: string;
  slogan: string;
  description: string;
  url: string;
  logo: string;
  keywords: string;
  email: string;
  phone: string;
  author: string;
  copyright: string;
  address: string;
}


export interface ICommonSettings {
  pageSize: number;
  isMaintenanceMode: boolean;
  freeShippingMinPrice: number;
  defaultTheme: string;
  defaultColor: string;
  featuredCategories: string[]; // Added to store category IDs or similar

}

/**
 * Third-party integration configuration
 */
export interface IThirdPartyIntegration {
  provider: string;
  providerName: string;
  type: string;
  apiKey?: string;
  secretKey?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface IPointsSettings {
  earnRate: number;
  redeemValue: number;
  registrationBonus: {
    buyer: number;
    seller: number;
  };
  sellerPointsPerSale: number;
  enabled: boolean;
  rate: number;
}

export interface ISettingInput {
  site: ISiteInfo;
  common: ICommonSettings;
  
  featuredSellerId?: string; 
  // featuredCategories: string[]; // Added to align with common.featuredCategories

  availableLanguages: Array<{
    name: string;
    code: string;
  }>;
    seo: {
    metaTitle: string;
    metaDescription: string;
    keywords: string;
    ogImage?: string;
    robots?: string;
  };
  carousels: Array<{
    title: string;
    url: string;
    image: string;
    buttonCaption: string;
    isPublished: boolean;
  }>;
  defaultLanguage: string;
  availableCurrencies: Array<{
    name: string;
    code: string;
    symbol: string;
    convertRate: number;
  }>;
  defaultCurrency: string;
  availablePaymentMethods: Array<{
    name: string;
    commission: number;
  }>;
  defaultPaymentMethod: string;
  availableDeliveryDates: Array<{
    name: string;
    daysToDeliver: number;
    shippingPrice: number;
    freeShippingMinPrice: number;
  }>;
  defaultDeliveryDate: string;
  integrations?: IThirdPartyIntegration[];
  points: IPointsSettings;
  aiAssistant: {
    price: number;
    description: string;
    image: string;
    enabled: boolean;
    freeLimit: number;
  };
}

// Seller types
export interface SellerRegistrationData {
  businessName: string;
  email: string;
  phone: string;
  description?: string;
  businessType: 'individual' | 'company';
  vatRegistered: boolean;
  logo?: string | null;
  address: {
    street: string;
    city: string;
    state: string;
    countryCode: string; // جعل countryCode إلزاميًا
    postalCode: string;
  };
  taxId?: string; // taxId اختياري
  termsAccepted: boolean;
  customSiteUrl?: string; // customSiteUrl اختياري
  is_trial?: boolean;
}

// Notification types
export interface INotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  channels: Array<'email' | 'push' | 'sms' | 'in_app' | 'whatsapp'>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'sent' | 'failed' | 'queued' | 'read';
  expiresAt?: Date;
  metadata?: {
    browser?: string;
    device?: string;
    ip?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  read: boolean;
  readAt?: Date;
  queuedAt?: Date;
}

// Product types
export type IProductInput = z.infer<typeof ProductInputSchema>;

export interface IProduct {
  _id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  listPrice: number;
  countInStock: number;
  images: string[];
  category: string;
  brand: string;
  offerEndTime?: string;
  tags: string[];
  colors: Array<{
    name: string;
    hex?: string;
    quantity: number;
    inStock: boolean;
    sizes: Array<{
      name: string;
      quantity: number;
      inStock: boolean;
    }>;
  }>;
  sizes: string[];
  isPublished: boolean;
  sellerId: string;
  seller: {
    name: string;
    email: string;
    subscription: string;
  };
  pricing: {
    basePrice: number;
    markup: number;
    profit: number;
    commission: number;
    finalPrice: number;
    discount?: number;
  };
  
   source?: {
    providerId: Types.ObjectId;
    productId: string;
  };
  warehouse: {
    providerName: string;
    sku: string;
    externalId: string;
    availableQuantity: number;
    location: string;
    lastSync: Date;
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: string;
    };
    weight?: {
      value: number;
      unit: string;
    };
    provider: string;

  };
  warehouseData: Array<{
    warehouseId: string;
    sku: string;
    quantity: number;
    location: string;
    minimumStock: number;
    reorderPoint: number;
    colors: Array<{
      name: string;
      hex?: string;
      quantity: number;
      inStock: boolean;
      sizes: Array<{
        name: string;
        quantity: number;
        inStock: boolean;
      }>;
    }>;
    lastUpdated: Date;
    updatedBy: string;
  }>;
  thirdPartyTokens?: Array<{
    provider: string;
    token: string;
    expiresAt?: Date;
  }>;
  metrics: {
    views: number;
    sales: number;
    revenue: number;
    returns: number;
    rating: number;
  };
  status: 'active' | 'draft' | 'pending' | 'rejected';
  inventoryStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  adminReview?: {
    approved: boolean;
    reviewedAt: Date;
    reviewedBy: string;
    notes?: string;
  };
  reviews: Array<{
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    createdAt: string;
  }>;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Order types
export type IOrderInput = z.infer<typeof OrderInputSchema>;

export interface StorageConfig {
  products: any;
  image: { maxFileSize: number; allowedTypes: string[]; maxFiles: number; folder: string; compressionQuality: number; dimensions: Record<string, { width: number; height: number }>; aspectRatios: string[] };
  document: { maxFileSize: number; allowedTypes: string[]; maxFiles: number; folder: string; preserveFilename: boolean };
  video: { maxFileSize: number; allowedTypes: string[]; maxFiles: number; folder: string; maxDuration: number; transcoding: { formats: string[]; qualities: string[]; thumbnailTime: string } };
  audio: { maxFileSize: number; allowedTypes: string[]; maxFiles: number; folder: string; maxDuration: number };
}

export interface NotificationConfig {
  types: Record<string, { id: string; defaultChannels: string[]; priority: 'high' | 'medium' | 'urgent'; template: string; throttle: boolean; expiry?: string }>;
  channels: Record<string, { enabled: boolean; provider: string; rateLimits: { perMinute: number; perHour: number; perDay: number }; retries: { maxAttempts: number; backoff: string } }>;
  templates: { path: string; defaultLocale: string; supportedLocales: string[]; fallbackLocale: string };
  retention: Record<string, { read: number; unread: number; failed: number }>;
  throttling: { enabled: boolean; window: string; maxAttempts: number };
  delivery: { retryStrategy: string; maxRetries: number; timeout: string };
  }

  

  export interface SellerCheckoutFormProps {
    sellerId: string; 
    storeId: string; // ID of the store associated with the checkout
    paymentGateways: Array<{
      providerName: string;
      accountDetails: Record<string, string>;
      verified: boolean;
      isDefault: boolean;
      isInternal: boolean;
      sandbox?: boolean;
    }>; // List of seller's payment gateways from seller.model.ts
    availableIntegrations?: Array<{
      id: string;
      providerName: string;
      type: 'payment' | 'warehouse' | 'dropshipping' | 'accounting' | 'erp' | 'marketing' | 'messaging' | 'analytics';
      isActive: boolean;
      sandbox?: boolean;
      logoUrl?: string;
    }>; // Optional list of admin-created integrations for selection
    onSubmit: (data: {
      paymentGateways: Array<{
        providerName: string;
        accountDetails: Record<string, string>;
        verified: boolean;
        isDefault: boolean;
        isInternal: boolean;
        sandbox?: boolean;
      }>;
    }) => Promise<void>; // Callback to handle form submission, e.g., updating seller settings
    translations: Record<string, string>; // Translation strings for internationalization (based on add/page.tsx)
    isLoading?: boolean; // Optional loading state for form submission
    error?: string | null; // Optional error message for form feedback
  }

export interface OrderResponse {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
  };
  items: Array<{
    product: {
      _id: string;
      name: string;
      slug: string;
      image: string;
    };
    quantity: number;
    price: number;
    size?: string;
    color?: string;
  }>;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  paymentResult?: {
    id: string;
    status: string;
    email_address: string;
    pricePaid: string;
  };
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  totalPrice: number;
  expectedDeliveryDate: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  isPaid: boolean;
  paidAt?: Date;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  tracking?: {
    provider: string;
    trackingNumber: string;
    url?: string;
    lastUpdated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IOrderList {
  _id: string;
  user: string | { name: string; email: string } | null | undefined;
  items: any[];
  totalPrice: number;
  isPaid: boolean;
  paidAt?: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  createdAt: Date;
}





export interface OrderItem extends z.infer<typeof OrderItemSchema> {
  pointsUsed?: number;
  pointsDiscount?: number;
  
}
export interface Cart extends z.infer<typeof CartSchema> {
  pointsUsed?: number;
  pointsDiscount?: number;
}
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

// Site configuration types
export type SiteLanguage = z.infer<typeof SiteLanguageSchema>;
export type SiteCurrency = z.infer<typeof SiteCurrencySchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type DeliveryDate = z.infer<typeof DeliveryDateSchema>;
export type ICarousel = z.infer<typeof CarouselSchema>;

// Review types
export type IReviewInput = z.infer<typeof ReviewInputSchema>;
export type IReviewDetails = IReviewInput & {
  _id: string;
  createdAt: string;
  user: {
    name: string;
  };
};

// User types
export type IUserInput = z.infer<typeof UserInputSchema> & {
  notifications?: INotification[];
  fcmToken?: string;
  phone?: string;
  locale?: string;
};
export type IUserSignIn = z.infer<typeof UserSignInSchema>;
export type IUserSignUp = z.infer<typeof UserSignUpSchema>;

export type IUserName = z.infer<typeof UserNameSchema>;

// Webpage types
export type IWebPageInput = z.infer<typeof WebPageInputSchema>;

// Client setting types
export type ClientSetting = ISettingInput & {
  currency: string;
};

// Data structure types
export type Data = {
  find(arg0: (d: any) => boolean): unknown;
  settings: ISettingInput[];
  webPages: IWebPageInput[];
  users: IUserInput[];
  products: IProduct[];
  reviews: {
    title: string;
    rating: number;
    comment: string;
  }[];
  headerMenus: {
    name: string;
    href: string;
  }[];
  carousels: {
    image: string;
    url: string;
    title: string;
    buttonCaption: string;
    isPublished: boolean;
  }[];
};