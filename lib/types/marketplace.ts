export interface MarketplaceProduct {
    id?: string;
    title: string;
    description?: string;
    price: number;
    compareAtPrice?: number;
    sku: string;
    barcode?: string;
    vendor?: string;
    quantity: number;
    images: ProductImage[];
    variants: ProductVariant[];
    options: ProductOption[];
    categories: string[];
    tags: string[];
    attributes: { [key: string]: any };
    status: 'active' | 'draft' | 'archived' | 'pending' | 'imported' | 'failed';
    sourceUrl?: string;
    sourceId?: string;
    sourcePlatform: string;
    sourceStoreId?: string;
    createdAt?: Date;
    updatedAt?: Date;
    createdBy?: string;
    updatedBy?: string;
    lastSyncedAt?: Date;
    currency: string;
    region: string;
    warehouseData?: Array<{
      warehouseId: string;
      provider: string;
      sku: string;
      quantity: number;
      location?: string;
    }>;
    metadata?: Record<string, any>;
    error?: string;
  }
  
  export interface ProductImage {
    url: string;
    position?: number;
    alt?: string;
    variantIds?: string[];
    metadata?: { [key: string]: any };
  }
  
  export interface ProductVariant {
    id?: string;
    title: string;
    sku: string;
    barcode?: string;
    price: number;
    compareAtPrice?: number;
    quantity: number;
    options: { [key: string]: string };
    images?: ProductImage[];
    weight?: number;
    weightUnit?: 'kg' | 'g' | 'lb' | 'oz';
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: 'cm' | 'in';
    };
    metadata?: { [key: string]: any };
  }
  
  export interface ProductOption {
    name: string;
    values: string[];
    metadata?: { [key: string]: any };
  }
  
  export interface MarketplaceOrder {
    id: string;
    customerName: string;
    customerEmail: string;
    createdAt: Date;
    updatedAt?: Date;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
    items: {
      productId: string;
      variantId?: string;
      title: string;
      sku: string;
      quantity: number;
      price: number;
    }[];
    totalPrice: number;
    currency: string;
    sourcePlatform: string;
    sourceId?: string;
    shippingAddress?: any;
    billingAddress?: any;
    notes?: string;
    tags?: Array<string>;
    metadata?: { [key: string]: any };
  }
  
  export interface ImportOptions {
    source: 'file' | 'url' | 'api';
    format?: 'csv' | 'json' | 'xml';
    file?: File;
    url?: string;
    filters?: {
      categories?: string[];
      priceRange?: { min?: number; max?: number };
      status?: string[];
      dateRange?: { start?: Date; end?: Date };
    };
    mapping?: { [key: string]: string };
    transform?: (data: any) => Promise<MarketplaceProduct>;
    batchSize?: number;
    validateOnly?: boolean;
    skipExisting?: boolean;
  }
  
  export interface ExportOptions {
    format: 'csv' | 'json' | 'xml';
    includeFields?: string[];
    excludeFields?: string[];
    filters?: {
      categories?: string[];
      priceRange?: { min?: number; max?: number };
      status?: string[];
    };
    transformBeforeExport?: (product: MarketplaceProduct) => Promise<any>;
    compression?: boolean;
    destination?: 'file' | 'url' | 'api';
  }
  
  export interface ImportResult {
    success: boolean;
    products: MarketplaceProduct[];
    errors?: ImportError[];
    warnings?: ImportWarning[];
    stats: {
      total: number;
      imported: number;
      failed: number;
      updated: number;
      skipped: number;
      timeElapsed: number;
    };
    metadata?: { [key: string]: any };
  }
  
  export interface ImportError {
    code: string;
    message: string;
    product?: Partial<MarketplaceProduct>;
    line?: number;
    field?: string;
    details?: any;
  }
  
  export interface ImportWarning {
    code: string;
    message: string;
    product?: Partial<MarketplaceProduct>;
    suggestion?: string;
    details?: any;
  }
  
  export interface ExportResult {
    success: boolean;
    url?: string;
    data?: any;
    errors?: string[];
    stats: {
      total: number;
      exported: number;
      failed: number;
      timeElapsed: number;
    };
    metadata?: { [key: string]: any };
  }
  
  export interface MarketplaceConfig {
    platform: string;
    regions: {
      na: { id: string; currency: string }[];
      eu: { id: string; currency: string }[];
      arabic: { id: string; currency: string }[];
      fe: { id: string; currency: string }[];
    };
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    shopDomain?: string;
    supportsImport: boolean;
    supportsExport: boolean;
    supportsAnalytics: boolean;
    supportsSync: boolean;
    rateLimit?: {
      maxRetries: number;
      interval: number;
    };
    cache?: {
      enabled: boolean;
      ttl: number;
    };
    timeout?: number;
    retryOptions?: {
      maxRetries: number;
      initialDelay: number;
      maxDelay: number;
    };
  }
  
  export interface SyncOptions {
    direction: 'push' | 'pull' | 'bidirectional';
    conflictResolution: 'remote' | 'local' | 'manual' | 'newest';
    backup?: boolean;
    validateBeforeSync?: boolean;
    dryRun?: boolean;
    batchSize?: number;
    localProducts?: MarketplaceProduct[];
  }
  
  export interface SyncResult {
    success: boolean;
    conflicts: SyncConflict[];
    stats: {
      total: number;
      synced: number;
      conflicts: number;
      failed: number;
      timeElapsed: number;
    };
    backupId?: string;
  }
  
  export interface SyncConflict {
    type: 'update' | 'delete' | 'create';
    localProduct: MarketplaceProduct;
    remoteProduct: MarketplaceProduct;
    resolution?: 'remote' | 'local' | 'manual' | 'skip';
    resolved?: boolean;
  }
  
  export interface AnalyticsData {
    operationCounts: { [key: string]: number };
    errorRates: { [key: string]: number };
    averageResponseTimes: { [key: string]: number };
    successRates: { [key: string]: number };
    syncStats: {
      lastSync: Date;
      totalSyncs: number;
      successfulSyncs: number;
      failedSyncs: number;
    };
    performance: {
      averageImportTime: number;
      averageExportTime: number;
      averageProcessingTime: number;
    };
  }
  
  export interface TransformationRule {
    field: string;
    operation: 'map' | 'combine' | 'split' | 'format' | 'calculate';
    params: {
      sourceFields?: string[];
      format?: string;
      separator?: string;
      formula?: string;
      mappings?: { [key: string]: any };
      defaultValue?: any;
    };
    condition?: {
      field: string;
      operator: 'equals' | 'contains' | 'greater' | 'less' | 'exists';
      value: any;
    };
  }
  
  export interface BackupMetadata {
    id: string;
    timestamp: Date;
    type: 'auto' | 'manual';
    reason: string;
    products: number;
    size: number;
    checksum: string;
  }
  
  export interface BackupOptions {
    type: 'full' | 'incremental';
    retentionPolicy: {
      maxBackups: number;
      maxAge: number;
    };
    encryption?: boolean;
    compression?: boolean;
    destination?: 'local' | 'cloud' | 'external';
  }