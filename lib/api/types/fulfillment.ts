export interface FulfillmentCredentials {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  apiUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
  [key: string]: any; // دعم أي بيانات إضافية
}

export interface FulfillmentConfig {
  providerName: string; // من Integration.providerName
  type: string; // من Integration.type
  credentials: FulfillmentCredentials;
  settings?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FulfillmentOrderItem {
  sku: string;
  quantity: number;
  price?: number;
  currency?: string;
  metadata?: Record<string, any>;
}

export interface FulfillmentOrderAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone?: string;
  email?: string;
  metadata?: Record<string, any>;
}

export interface FulfillmentOrder {
  orderId: string;
  providerName: string; // من Integration.providerName
  userId: string;
  items: FulfillmentOrderItem[];
  shippingAddress: FulfillmentOrderAddress;
  shippingMethod?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface FulfillmentTracking {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  estimatedDeliveryDate?: string;
  status?: string;
  statusDetails?: string;
  lastUpdated?: string;
}

export interface FulfillmentError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  source?: string;
}

export interface FulfillmentResult {
  success: boolean;
  orderId: string;
  fulfillmentId: string;
  providerName: string; // من Integration.providerName
  status: FulfillmentStatus;
  tracking?: FulfillmentTracking;
  metadata?: Record<string, any>;
  errors?: FulfillmentError[];
  timestamp: string;
  processedBy: string;
}

export type FulfillmentStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed';

export interface InventoryLevel {
  sku: string;
  quantity: number;
  warehouseId?: string;
  location?: string;
  lastUpdated: string;
  updatedBy: string;
}

export interface InventoryUpdate {
  sku: string;
  quantity: number;
  type: 'increment' | 'decrement' | 'set';
  reason?: string;
  reference?: string;
  timestamp: string;
  updatedBy: string;
}

export interface FulfillmentWebhook {
  type: string;
  providerName: string; // من Integration.providerName
  orderId: string;
  fulfillmentId: string;
  data: any;
  timestamp: string;
  signature?: string;
}

export interface RateQuote {
  providerName: string; // من Integration.providerName
  service: string;
  rate: number;
  currency: string;
  transitDays: number;
  estimatedDeliveryDate: string;
  restrictions?: string[];
  metadata?: Record<string, any>;
  timestamp: string;
  calculatedBy: string;
}