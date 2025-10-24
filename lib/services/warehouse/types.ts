// /lib/services/warehouse/types.ts

/**
 * Warehouse provider interface for interacting with warehouse services
 */
export interface WarehouseProvider {
  name: string;
  createProduct: (request: CreateProductRequest) => Promise<{ id: string }>;
  updateProduct: (request: UpdateProductRequest) => Promise<void>;
  createShipment: (request: CreateShipmentRequest) => Promise<ShipmentResponse>;
  getShipmentStatus: (trackingId: string) => Promise<ShipmentStatus>;
  getInventory: (productId: string) => Promise<WarehouseProduct>;
  updateInventory: (productId: string, quantity: number) => Promise<void>;
}

/**
 * Request to create a new product in the warehouse
 */
export interface CreateProductRequest {
  name: string;
  sku: string;
  description?: string;
  price?: number;
  images?: string[];
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit?: 'cm' | 'in';
  };
  weight?: number;
  weightUnit?: 'kg' | 'lb';
  quantity?: number;
}

/**
 * Request to update an existing product in the warehouse
 */
export interface UpdateProductRequest {
  externalId: string;
  sku: string;
  name: string;
  description?: string;
  price?: number;
  images?: string[];
  quantity: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit?: 'cm' | 'in';
  };
  weight?: number;
  weightUnit?: 'kg' | 'lb';
}

/**
 * Request to create a shipment for an order
 */
export interface CreateShipmentRequest {
  orderId: string;
  items: {
    productId: string;
    sku: string;
    quantity: number;
  }[];
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone?: string;
  };
  shippingMethod?: string;
}

/**
 * Response for a created shipment
 */
export interface ShipmentResponse {
  trackingId: string;
  status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  carrier?: string;
  trackingUrl?: string;
}

/**
 * Status of a shipment
 */
export interface ShipmentStatus {
  trackingId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'exception' | 'onhold';
  carrier?: string;
  service?: any;
  orderId?: any;
  trackingUrl?: string;
  fulfillmentId?: string;
  estimatedDeliveryDate?: Date;
  lastUpdated?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  trackingEvents?: ShipmentEvent[];
  events?: ShipmentEvent[];
}

/**
 * Event in the shipment tracking history
 */
export interface ShipmentEvent {
  date: Date;
  status: string;
  location?: string;
  description?: string;
}

/**
 * Product details in the warehouse inventory
 */
export interface WarehouseProduct {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  location?: string;
  price?: number;
}

/**
 * Product interface for marketplace operations
 */
export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price?: number;
  images?: string[];
}

// Marketplace Types (Separated for clarity)
/**
 * Marketplace provider interface for importing/exporting products
 */
export interface MarketplaceProvider {
  name: string;
  importProducts(options: ImportOptions): Promise<ImportResult>;
  exportProducts(products: Product[], options: ExportOptions): Promise<ExportResult>;
}

/**
 * Options for importing products
 */
export interface ImportOptions {
  source: string;
  file?: File;
  productId?: string;
  url?: string;
  manual?: boolean;
}

/**
 * Result of importing products
 */
export interface ImportResult {
  success: boolean;
  products: Product[];
  errors?: string[];
}

/**
 * Options for exporting products
 */
export interface ExportOptions {
  target: string;
  format: 'csv' | 'json' | 'xml';
  includeFields?: string[];
}

/**
 * Result of exporting products
 */
export interface ExportResult {
  success: boolean;
  url?: string;
  errors?: string[];
}