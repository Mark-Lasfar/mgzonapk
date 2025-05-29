export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse {
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IProductInput {
  name: string;
  slug: string;
  category: string;
  images: string[];
  brand: string;
  description: string;
  price: number;
  listPrice: number;
  countInStock: number;
  tags: string[];
  sizes: Array<{
    name: string;
    quantity: number;
    inStock: boolean;
  }>;
  colors: Array<{
    name: string;
    hex: string;
    inStock: boolean;
    sizes?: Array<{
      name: string;
      quantity: number;
      inStock: boolean;
    }>;
  }>;
  warehouseData: Array<{
    warehouseId: string;
    provider: 'ShipBob' | '4PX';
    sku: string;
    quantity: number;
    location: string;
    minimumStock: number;
    reorderPoint: number;
    colors: Array<{
      name: string;
      hex: string;
      quantity: number;
      inStock: boolean;
      sizes: Array<{
        name: string;
        quantity: number;
        inStock: boolean;
      }>;
    }>;
    lastUpdated?: Date;
    updatedBy?: string;
  }>;
  isPublished: boolean;
  status: 'draft' | 'pending' | 'active' | 'rejected';
  pricing: {
    basePrice: number;
    markup: number;
    profit: number;
    commission: number;
    finalPrice: number;
    discount?: {
      type: 'none' | 'percentage' | 'fixed';
      value: number;
      startDate?: Date;
      endDate?: Date;
    };
  };
  metrics: {
    views: number;
    sales: number;
    revenue: number;
    returns: number;
    rating: number;
    reviewsCount: number;
  };
  sellerId?: string;
  seller?: {
    name: string;
    email: string;
    subscription?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
}

export interface IReviewDetails {
  _id: string;
  title: string;
  comment: string;
  rating: number;
  user: {
    _id: string;
    name: string;
  };
  product: string;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  key: string;
  secret: string;
  permissions: ApiPermission[];
  createdAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export type ApiPermission =
  | 'products:read'
  | 'products:write'
  | 'orders:read'
  | 'orders:write'
  | 'customers:read'
  | 'customers:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'analytics:read'
  | 'withdrawals:read'
  | 'withdrawals:write';

export interface WebhookConfig {
  _id?: string;
  userId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  lastError?: string;
  retryCount: number;
}

export type WebhookEvent =
  | 'order.created'
  | 'order.updated'
  | 'order.fulfilled'
  | 'order.cancelled'
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'inventory.updated'
  | 'customer.created'
  | 'customer.updated'
  | 'withdrawal.created'
  | 'withdrawal.updated'
  | 'seller.registered'
  | 'seller.updated';

export type FulfillmentProvider = 'shipbob' | 'amazon' | 'aliexpress' | '4px';

export interface FulfillmentConfig {
  provider: FulfillmentProvider;
  apiKey: string;
  apiSecret?: string;
  warehouseId?: string;
  region?: string;
  sandbox?: boolean;
  settings?: Record<string, any>;
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

export interface InventoryLevel {
  sku: string;
  quantity: number;
  warehouseId?: string;
  location?: string;
  lastUpdated: string;
  updatedBy: string;
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
  provider: FulfillmentProvider;
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

export type PaymentMethod = 'stripe' | 'paypal' | 'bank_transfer';

export interface Notification {
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels: ('email' | 'push' | 'sms' | 'in_app')[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'sent' | 'failed' | 'queued' | 'read';
  expiresAt?: Date;
  metadata?: {
    browser?: string;
    device?: string;
    ip?: string;
  };
  read: boolean;
  readAt?: Date;
  queuedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeStamped {
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

export interface WarehouseProvider {
  name: string;
  createShipment: (request: any) => Promise<{ trackingId: string }>;
  getShipmentStatus: (trackingId: string) => Promise<ShipmentStatus>;
  getInventory: (productId: string) => Promise<WarehouseProduct>;
  updateInventory: (productId: string, quantity: number) => Promise<void>;
}

export interface WarehouseProduct {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  location: string;
}

export interface ShipmentStatus {
  status: string;
  trackingNumber: string;
  estimatedDelivery?: string;
}