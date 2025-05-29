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
  [key: string]: unknown;
}

export interface ICommonSettings {
  pageSize: number;
  isMaintenanceMode: boolean;
  freeShippingMinPrice: number;
  defaultTheme: string;
  defaultColor: string;
}

export interface ISettingInput {
  site: ISiteInfo;
  common: ICommonSettings;
  availableLanguages: Array<{
    name: string;
    code: string;
  }>;
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
  [key: string]: unknown;
}

// Seller types
export interface SellerRegistrationData {
  businessName: string;
  email: string;
  phone: string;
  description?: string;
  businessType: 'individual' | 'company';
  vatRegistered: boolean;
  logo?: File;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  taxId: string;
  bankInfo: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode: string;
  };
  termsAccepted: boolean;
  customSiteUrl: string; // Added for custom site URL
}

// Notification types
export interface INotification {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  channels: Array<'email' | 'push' | 'sms' | 'in_app'>;
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
  warehouse: {
    provider: string;
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
    createdAt: Date;
  }>;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

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

// Order types
export type IOrderInput = z.infer<typeof OrderInputSchema>;
export type IOrderList = IOrderInput & {
  _id: string;
  user: {
    name: string;
    email: string;
  };
  createdAt: Date;
};
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Cart = z.infer<typeof CartSchema>;
export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

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