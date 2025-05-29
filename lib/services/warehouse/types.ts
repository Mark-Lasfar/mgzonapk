export interface WarehouseProvider {
  name: string;
  createShipment(request: CreateShipmentRequest): Promise<ShipmentResponse>;
  getShipmentStatus(trackingId: string): Promise<ShipmentStatus>;
  getInventory(productId: string): Promise<WarehouseProduct>;
  updateInventory(productId: string, quantity: number): Promise<void>;
}

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
    phone: string;
  };
}

export interface ShipmentResponse {
  trackingId: string;
}

export interface ShipmentStatus {
  trackingId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  estimatedDeliveryDate?: Date;
  location?: string;
  events?: ShipmentEvent[];
}

export interface ShipmentEvent {
  date: Date;
  status: string;
  location: string;
}

export interface WarehouseProduct {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  location?: string;
}

// Marketplace Types (للاستيراد والتصدير)
export interface MarketplaceProvider {
  name: string;
  importProducts(options: ImportOptions): Promise<ImportResult>;
  exportProducts(products: Product[], options: ExportOptions): Promise<ExportResult>;
}

export interface ImportOptions {
  source: string;
  file?: File;
  url?: string;
  manual?: boolean;
}

export interface ImportResult {
  success: boolean;
  products: Product[];
  errors?: any[];
}

export interface ExportOptions {
  target: string;
  format: 'csv' | 'json' | 'xml';
  includeFields?: string[];
}

export interface ExportResult {
  success: boolean;
  url?: string;
  errors?: any[];
}