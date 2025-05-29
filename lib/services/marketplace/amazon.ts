import { createCSV,parseCSV } from '@/lib/utils/csv';
import { parseXML } from '@/lib/utils/xml';
import { logger } from '../logging';
import { 
    MarketplaceProduct, 
    ProductImage,
    ProductVariant,
    ProductOption,
    ImportOptions, 
    ImportResult, 
    ExportOptions, 
    ExportResult,
    ImportError,
    ImportWarning,
    MarketplaceConfig,
    SyncOptions,
    SyncResult,
    SyncConflict,
    AnalyticsData,
    TransformationRule,
    BackupMetadata
  , MarketplaceOrder

  } from './types';
//   import { parseCSV, createCSV } from '../../utils/csv';
//   import { parseXML, createXL } from '../../utils/xml';
//   import { logger } from '../../utils/logger';
  
  // Cache Manager for improved performance
  class CacheManager {
    private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
    set(key: string, data: any, ttl: number = 3600000): void {
      this.cache.set(key, { data, timestamp: Date.now(), ttl });
    }
  
    get(key: string): any {
      const item = this.cache.get(key);
      if (!item) return null;
      if (Date.now() - item.timestamp > item.ttl) {
        this.cache.delete(key);
        return null;
      }
      return item.data;
    }
  
    clear(): void {
      this.cache.clear();
    }
  }
  
  // Rate Limiter to prevent exceeding API limits
  class RateLimiter {
    private requests: number = 0;
    private lastReset: number = Date.now();
  
    constructor(private readonly limit: number = 100, private readonly interval: number = 60000) {}
  
    async checkLimit(): Promise<boolean> {
      const now = Date.now();
      if (now - this.lastReset > this.interval) {
        this.requests = 0;
        this.lastReset = now;
      }
      if (this.requests >= this.limit) {
        const waitTime = this.interval - (now - this.lastReset);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.checkLimit();
      }
      this.requests++;
      return true;
    }
  }
  
  // Simple Event Emitter implementation for tracking operations
  type EventType = 'import:start' | 'import:end' | 'export:start' | 'export:end' | 'error';
  
  class EventEmitter {
    private listeners: Map<EventType, Function[]> = new Map();
  
    on(event: EventType, callback: Function): void {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  
    emit(event: EventType, data?: any): void {
      const callbacks = this.listeners.get(event) || [];
      callbacks.forEach(callback => callback(data));
    }
  }
  
  // Custom Error class for Amazon API errors
  class AmazonAPIError extends Error {
    constructor(public readonly code: string, message: string, public readonly details?: any) {
      super(message);
      this.name = 'AmazonAPIError';
    }
  }
  
  // Analytics class to track operations and performance
  class Analytics {
    private data: AnalyticsData = {
      operationCounts: {},
      errorRates: {},
      averageResponseTimes: {},
      successRates: {},
      syncStats: { lastSync: new Date(), totalSyncs: 0, successfulSyncs: 0, failedSyncs: 0 },
      performance: { averageImportTime: 0, averageExportTime: 0, averageProcessingTime: 0 }
    };
  
    trackOperation(operation: string, duration: number, success: boolean): void {
      this.data.operationCounts[operation] = (this.data.operationCounts[operation] || 0) + 1;
      // Calculate average response times and success rates (simplified)
      const previousAvg = this.data.averageResponseTimes[operation] || 0;
      const count = this.data.operationCounts[operation];
      this.data.averageResponseTimes[operation] = ((previousAvg * (count - 1)) + duration) / count;
      this.data.successRates[operation] = (this.data.successRates[operation] || 0) + (success ? 1 : 0);
    }
  
    generateReport(): AnalyticsData {
      return this.data;
    }
  }
  
  // Product Transformer for advanced field transformations
  class ProductTransformer {
    private rules: TransformationRule[] = [];
  
    addRule(rule: TransformationRule): void {
      this.rules.push(rule);
    }
  
    async transform(product: MarketplaceProduct): Promise<MarketplaceProduct> {
      let transformed = { ...product };
      for (const rule of this.rules) {
        transformed = await this.applyRule(transformed, rule);
      }
      return transformed;
    }
  
    private async applyRule(product: MarketplaceProduct, rule: TransformationRule): Promise<MarketplaceProduct> {
      // Dummy implementation: extend this to cover 'combine', 'split', 'format', etc.
      if (rule.operation === 'map' && rule.params.mappings) {
        product[rule.field] = rule.params.mappings[product[rule.field]] || product[rule.field];
      }
      return product;
    }
  }
  
  // Main AmazonMarketplace class
  export class AmazonMarketplace {
    private api: AmazonAPI;
    private performance: PerformanceTracker;
    private cache: CacheManager;
    private rateLimiter: RateLimiter;
    private events: EventEmitter;
    private analytics: Analytics;
    private transformer: ProductTransformer;
  
    constructor(private config: MarketplaceConfig) {
      this.api = new AmazonAPI(config);
      this.performance = new PerformanceTracker();
      this.cache = new CacheManager();
      this.rateLimiter = new RateLimiter(config.rateLimit?.maxRequests || 100, config.rateLimit?.interval || 60000);
      this.events = new EventEmitter();
      this.analytics = new Analytics();
      this.transformer = new ProductTransformer();
    }
  
    // Method to import products
    async importProducts(options: ImportOptions): Promise<ImportResult> {
      this.events.emit('import:start', options);
      this.performance.start('importProducts');
      await this.rateLimiter.checkLimit();
      const startTime = Date.now();
      const errors: ImportError[] = [];
      const warnings: ImportWarning[] = [];
      let products: MarketplaceProduct[] = [];
  
      try {
        // Authenticate using retry mechanism
        await this.retryOperation(() => this.api.authenticate());
  
        // Import based on source type
        switch (options.source) {
          case 'file':
            products = await this.importFromFile(options);
            break;
          case 'url':
            products = await this.importFromUrl(options);
            break;
          case 'api':
            products = await this.importFromAPI(options);
            break;
          default:
            throw new Error('Invalid import source');
        }
  
        // Apply filters if provided
        if (options.filters) {
          products = this.filterProducts(products, options.filters);
        }
  
        // Apply transformation rules if provided
        if (options.mapping || options.transform) {
          products = await this.transformProducts(products, options);
        }
  
        // Validate and process each product
        const processedProducts: MarketplaceProduct[] = [];
        let updatedCount = 0;
        let skippedCount = 0;
  
        // Process products in batches
        const batchSize = options.batchSize || 50;
        const batches = this.createBatches(products, batchSize);
        
        for (const batch of batches) {
          const batchResults = await Promise.allSettled(
            batch.map(async product => {
              try {
                // Validate product
                let validatedProduct = await this.validateProduct(product);
                // Transform product using advanced transformer
                validatedProduct = await this.transformer.transform(validatedProduct);
                // Process images
                validatedProduct.images = await this.api.processProductImages(validatedProduct);
                // Process variants, if present
                if (validatedProduct.variants?.length) {
                  validatedProduct.variants = await this.processVariants(validatedProduct);
                }
                // Check if product exists remotely
                const existingProduct = await this.api.findProductBySKU(product.sku);
                if (existingProduct) {
                  const updated = await this.api.updateProduct(existingProduct.id, validatedProduct);
                  updatedCount++;
                  return updated;
                } else {
                  const created = await this.api.createProduct(validatedProduct);
                  processedProducts.push(created);
                  return created;
                }
              } catch (error: any) {
                errors.push({
                  code: 'VALIDATION_ERROR',
                  message: error.message,
                  product,
                  field: error.field
                });
                skippedCount++;
                return null;
              }
            })
          );
  
          batchResults.forEach((result, index) => {
            if (result.status === 'rejected') {
              errors.push({
                code: 'PROCESSING_ERROR',
                message: result.reason.message,
                product: batch[index]
              });
            }
          });
        }
  
        const timeElapsed = Date.now() - startTime;
        this.performance.end('importProducts');
        this.analytics.trackOperation('importProducts', timeElapsed, errors.length === 0);
        this.events.emit('import:end', { result: 'success', stats: { total: products.length } });
  
        return {
          success: errors.length === 0,
          products: processedProducts,
          errors: errors.length > 0 ? errors : undefined,
          warnings: warnings.length > 0 ? warnings : undefined,
          stats: {
            total: products.length,
            imported: processedProducts.length,
            failed: errors.length,
            updated: updatedCount,
            skipped: skippedCount,
            timeElapsed
          },
          metadata: { importedAt: new Date().toISOString() }
        };
      } catch (error: any) {
        logger.error('Amazon import error:', error);
        this.performance.end('importProducts');
        this.events.emit('error', { error: error.message });
        return {
          success: false,
          products: [],
          errors: [{
            code: 'IMPORT_FAILED',
            message: error.message
          }],
          stats: {
            total: 0,
            imported: 0,
            failed: 1,
            updated: 0,
            skipped: 0,
            timeElapsed: Date.now() - startTime
          }
        };
      }
    }
  
    // Method to export products
    async exportProducts(products: MarketplaceProduct[], options: ExportOptions): Promise<ExportResult> {
      this.events.emit('export:start', options);
      this.performance.start('exportProducts');
      await this.rateLimiter.checkLimit();
      const startTime = Date.now();
      try {
        // Apply filters on export if provided
        if (options.filters) {
          products = this.filterProducts(products, options.filters);
        }
        // Optionally transform products before export
        if (options.transformBeforeExport) {
          products = await Promise.all(products.map(p => options.transformBeforeExport(p)));
        }
        // Determine fields to export
        const fields = this.getExportFields(options);
        let exportedData: string;
        switch (options.format) {
          case 'csv':
            exportedData = await this.exportToCSV(products, fields);
            break;
          case 'json':
            exportedData = await this.exportToJSON(products, fields);
            break;
          case 'xml':
            exportedData = await this.exportToXML(products, fields);
            break;
          default:
            throw new Error(`Unsupported export format: ${options.format}`);
        }
        // Upload exported data if destination requires it
        let uploadedUrl: string | undefined;
        if (exportedData) {
          uploadedUrl = await this.retryOperation(() => this.api.uploadFile(exportedData, options.format));
        }
        const timeElapsed = Date.now() - startTime;
        this.performance.end('exportProducts');
        this.analytics.trackOperation('exportProducts', timeElapsed, true);
        this.events.emit('export:end', { result: 'success', stats: { total: products.length } });
        return {
          success: true,
          url: uploadedUrl,
          data: exportedData,
          stats: {
            total: products.length,
            exported: products.length,
            failed: 0,
            timeElapsed
          },
          metadata: { exportedAt: new Date().toISOString() }
        };
      } catch (error: any) {
        logger.error('Amazon export error:', error);
        this.performance.end('exportProducts');
        this.events.emit('error', { error: error.message });
        return {
          success: false,
          errors: [error.message],
          stats: {
            total: products.length,
            exported: 0,
            failed: products.length,
            timeElapsed: Date.now() - startTime
          }
        };
      }
    }
  
    // Method to synchronize products with local DB and remote API
    async syncProducts(options: SyncOptions): Promise<SyncResult> {
      const startTime = Date.now();
      // Retrieve local products (assumed to be implemented elsewhere)
      const localProducts = await this.getLocalProducts();
      // Retrieve remote products via API
      const remoteProducts = await this.api.getProducts();
      let conflicts: SyncConflict[] = [];
      // Optionally backup local products
      if (options.backup) {
        await this.backupProducts(localProducts);
      }
      // Find conflicts between local and remote data
      conflicts = this.findConflicts(localProducts, remoteProducts);
      // Handle conflicts based on resolution strategy
      if (conflicts.length > 0) {
        await this.handleConflicts(conflicts, options.conflictResolution);
      }
      // Perform sync based on direction
      let syncedCount = 0;
      if (options.direction === 'push' || options.direction === 'bidirectional') {
        syncedCount += await this.pushToRemote(localProducts);
      }
      if (options.direction === 'pull' || options.direction === 'bidirectional') {
        syncedCount += await this.pullFromRemote(remoteProducts);
      }
      const timeElapsed = Date.now() - startTime;
      return {
        success: conflicts.length === 0,
        conflicts,
        stats: {
          total: localProducts.length,
          synced: syncedCount,
          conflicts: conflicts.length,
          failed: localProducts.length - syncedCount,
          timeElapsed
        },
        backupId: options.backup ? "backup_" + Date.now() : undefined
      };
    }
  
    // Dummy method to get local products from a database
    private async getLocalProducts(): Promise<MarketplaceProduct[]> {
      // Replace with actual DB fetch
      return [];
    }
  
    // Dummy method to backup products
    private async backupProducts(products: MarketplaceProduct[]): Promise<void> {
      const backupMetadata: BackupMetadata = {
        id: "backup_" + Date.now(),
        timestamp: new Date(),
        type: "auto",
        reason: "Scheduled backup",
        products: products.length,
        size: JSON.stringify(products).length,
        checksum: "dummy-checksum"
      };
      // Save backup to file or DB
      logger.info("Backup created", backupMetadata);
    }
  
    // Dummy method to find conflicts between local and remote products
    private findConflicts(local: MarketplaceProduct[], remote: MarketplaceProduct[]): SyncConflict[] {
      // Implement actual conflict detection logic
      return [];
    }
  
    // Dummy method to handle conflicts
    private async handleConflicts(conflicts: SyncConflict[], resolution: SyncOptions["conflictResolution"]): Promise<void> {
      // Implement conflict resolution logic
      conflicts.forEach(conflict => {
        conflict.resolution = resolution;
        conflict.resolved = true;
      });
    }
  
    // Dummy method to push local products to remote API
    private async pushToRemote(products: MarketplaceProduct[]): Promise<number> {
      let count = 0;
      for (const product of products) {
        try {
          await this.api.createProduct(product);
          count++;
        } catch (error) {
          logger.error("Push to remote failed for SKU:", product.sku, error);
        }
      }
      return count;
    }
  
    // Dummy method to pull products from remote API into local DB
    private async pullFromRemote(remoteProducts: MarketplaceProduct[]): Promise<number> {
      // Replace with actual DB update logic
      return remoteProducts.length;
    }
  
    // Process product variants using API methods
    private async processVariants(product: MarketplaceProduct): Promise<ProductVariant[]> {
      const processedVariants: ProductVariant[] = [];
      for (const variant of product.variants) {
        try {
          if (!variant.sku || !variant.price) {
            throw new Error(`Invalid variant data for ${variant.title}`);
          }
          const existingVariant = await this.api.findProductBySKU(variant.sku);
          if (existingVariant) {
            throw new Error(`Duplicate SKU found: ${variant.sku}`);
          }
          if (variant.images?.length) {
            const processedImages = await this.api.processProductImages({
              ...product,
              images: variant.images
            });
            variant.images = processedImages;
          }
          processedVariants.push(variant);
        } catch (error: any) {
          logger.error(`Failed to process variant: ${error.message}`);
        }
      }
      return processedVariants;
    }
  
    // Import products from a file
    private async importFromFile(options: ImportOptions): Promise<MarketplaceProduct[]> {
      if (!options.file) {
        throw new Error('File is required for file import');
      }
      const content = await options.file.text();
      const format = options.format || options.file.name.split('.').pop()?.toLowerCase();
      switch (format) {
        case 'csv':
          return parseCSV<MarketplaceProduct>(content);
        case 'json':
          return JSON.parse(content);
        case 'xml':
          return parseXML<MarketplaceProduct>(content);
        default:
          throw new Error(`Unsupported file format: ${format}`);
      }
    }
  
    // Import products from a URL
    private async importFromUrl(options: ImportOptions): Promise<MarketplaceProduct[]> {
      if (!options.url) {
        throw new Error('URL is required for URL import');
      }
      const response = await this.retryOperation(() => fetch(options.url));
      const content = await response.text();
      switch (options.format) {
        case 'csv':
          return parseCSV<MarketplaceProduct>(content);
        case 'json':
          return JSON.parse(content);
        case 'xml':
          return parseXML<MarketplaceProduct>(content);
        default:
          throw new Error(`Unsupported format: ${options.format}`);
      }
    }
  
    // Import products using API
    private async importFromAPI(options: ImportOptions): Promise<MarketplaceProduct[]> {
      return this.api.getProducts(options.filters);
    }
  
    // Filter products based on provided filters
    private filterProducts(products: MarketplaceProduct[], filters: ImportOptions['filters']): MarketplaceProduct[] {
      if (!filters) return products;
      return products.filter(product => {
        if (filters.categories?.length && !filters.categories.some(c => product.categories.includes(c))) {
          return false;
        }
        if (filters.priceRange) {
          const { min, max } = filters.priceRange;
          if (min && product.price < min) return false;
          if (max && product.price > max) return false;
        }
        if (filters.status?.length && !filters.status.includes(product.status)) {
          return false;
        }
        if (filters.dateRange) {
          const productDate = new Date(product.createdAt || product.updatedAt);
          if (filters.dateRange.start && productDate < filters.dateRange.start) {
            return false;
          }
          if (filters.dateRange.end && productDate > filters.dateRange.end) {
            return false;
          }
        }
        return true;
      });
    }
  
    // Validate product data
    private async validateProduct(product: MarketplaceProduct): Promise<MarketplaceProduct> {
      const errors: string[] = [];
      if (!product.title?.trim()) errors.push('Title is required');
      if (!product.sku?.trim()) errors.push('SKU is required');
      if (typeof product.price !== 'number' || product.price < 0) {
        errors.push('Price must be a positive number');
      }
      if (!product.vendor?.trim()) errors.push('Vendor is required');
      if (!Array.isArray(product.images) || product.images.length === 0) {
        errors.push('At least one image is required');
      } else {
        product.images.forEach((image, index) => {
          if (!image.url) errors.push(`Image ${index + 1} URL is required`);
        });
      }
      if (product.variants?.length) {
        product.variants.forEach((variant, index) => {
          if (!variant.sku) errors.push(`Variant ${index + 1} SKU is required`);
          if (!variant.title) errors.push(`Variant ${index + 1} title is required`);
          if (typeof variant.price !== 'number' || variant.price < 0) {
            errors.push(`Variant ${index + 1} price must be a positive number`);
          }
          if (!variant.options || Object.keys(variant.options).length === 0) {
            errors.push(`Variant ${index + 1} must have at least one option`);
          }
        });
      }
      if (product.options?.length) {
        product.options.forEach((option, index) => {
          if (!option.name) errors.push(`Option ${index + 1} name is required`);
          if (!Array.isArray(option.values) || option.values.length === 0) {
            errors.push(`Option ${index + 1} must have at least one value`);
          }
        });
      }
      if (!product.description?.trim()) errors.push('Description is required');
      if (!Array.isArray(product.categories) || product.categories.length === 0) {
        errors.push('At least one category is required');
      }
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`);
      }
      return product;
    }
  
    // Transform products based on mapping or custom function
    private async transformProducts(products: MarketplaceProduct[], options: ImportOptions): Promise<MarketplaceProduct[]> {
      const transformed: MarketplaceProduct[] = [];
      for (const product of products) {
        let transformedProduct = { ...product };
        if (options.mapping) {
          Object.entries(options.mapping).forEach(([from, to]) => {
            transformedProduct[to] = product[from];
          });
        }
        if (options.transform) {
          transformedProduct = await options.transform(transformedProduct);
        }
        transformed.push(transformedProduct);
      }
      return transformed;
    }
  
    // Determine fields to include for export
    private getExportFields(options: ExportOptions): string[] {
      const allFields = [
        'id', 'title', 'description', 'price', 'compareAtPrice',
        'sku', 'barcode', 'vendor', 'quantity', 'images',
        'variants', 'options', 'categories', 'tags', 'attributes',
        'status', 'sourceUrl', 'sourceId', 'sourcePlatform'
      ];
      if (options.includeFields) {
        return options.includeFields;
      }
      if (options.excludeFields) {
        return allFields.filter(field => !options.excludeFields.includes(field));
      }
      return allFields;
    }
  
    // Create batches of items
    private createBatches<T>(items: T[], batchSize: number): T[][] {
      const batches: T[][] = [];
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
      }
      return batches;
    }
  
    // Retry an operation with exponential backoff
    private async retryOperation<T>(
      operation: () => Promise<T>,
      retries: number = this.config.retryOptions?.maxRetries || 3,
      delay: number = this.config.retryOptions?.initialDelay || 1000
    ): Promise<T> {
      try {
        return await operation();
      } catch (error) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
      }
    }
  
    // Export methods for CSV, JSON, and XML
    private async exportToCSV(products: MarketplaceProduct[], fields: string[]): Promise<string> {
      return createCSV(products, fields);
    }
  
    private async exportToJSON(products: MarketplaceProduct[], fields: string[]): Promise<string> {
      const filteredProducts = products.map(product => {
        const filtered: any = {};
        fields.forEach(field => filtered[field] = product[field]);
        return filtered;
      });
      return JSON.stringify(filteredProducts, null, 2);
    }
  
    private async exportToXML(products: MarketplaceProduct[], fields: string[]): Promise<string> {
      return createXML('products', products, fields);
    }
  }
  
  // AmazonAPI handles remote API interactions
  class AmazonAPI {
    private accessToken?: string;
  
    constructor(private config: MarketplaceConfig) {}
  
    async authenticate(): Promise<void> {
      const response = await fetch(`${this.config.apiUrl}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
          grant_type: 'refresh_token'
        })
      });
      if (!response.ok) {
        throw new AmazonAPIError('AUTH_FAILED', 'Authentication failed');
      }
      const data = await response.json();
      this.accessToken = data.access_token;
    }
  
    async getProducts(filters?: ImportOptions['filters']): Promise<MarketplaceProduct[]> {
      const response = await this.request('/products', { method: 'GET', params: filters });
      return response.products;
    }
  
    async findProductBySKU(sku: string): Promise<MarketplaceProduct | null> {
      const response = await this.request('/products/lookup', { method: 'GET', params: { sku } });
      return response.product || null;
    }
  
    async createProduct(product: MarketplaceProduct): Promise<MarketplaceProduct> {
      const response = await this.request('/products', { method: 'POST', body: product });
      return response.product;
    }
  
    async updateProduct(id: string, product: MarketplaceProduct): Promise<MarketplaceProduct> {
      const response = await this.request(`/products/${id}`, { method: 'PUT', body: product });
      return response.product;
    }
  
    async uploadFile(content: string, format: string): Promise<string> {
      const response = await this.request('/upload', { method: 'POST', body: { content, format } });
      return response.url;
    }
  
    async uploadImage(image: File | string): Promise<string> {
      const formData = new FormData();
      if (typeof image === 'string') {
        const response = await fetch(image);
        const blob = await response.blob();
        formData.append('image', blob);
      } else {
        formData.append('image', image);
      }
      const response = await fetch(`${this.config.apiUrl}/images/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
        body: formData
      });
      if (!response.ok) {
        throw new AmazonAPIError('IMAGE_UPLOAD_FAILED', 'Failed to upload image');
      }
      const data = await response.json();
      return data.url;
    }
  
    async processProductImages(product: MarketplaceProduct): Promise<ProductImage[]> {
      const processedImages: ProductImage[] = [];
      for (const image of product.images) {
        try {
          const uploadedUrl = await this.uploadImage(image.url);
          processedImages.push({ ...image, url: uploadedUrl });
        } catch (error: any) {
          logger.error(`Failed to process image: ${error.message}`);
        }
      }
      return processedImages;
    }
  
    // Generic request method with authentication & retry
    private async request(endpoint: string, options: { method: string; params?: any; body?: any }): Promise<any> {
      if (!this.accessToken) {
        await this.authenticate();
      }
      const url = new URL(this.config.apiUrl + endpoint);
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          url.searchParams.append(key, String(value));
        });
      }
      const response = await fetch(url.toString(), {
        method: options.method,
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      if (!response.ok) {
        if (response.status === 401) {
          await this.authenticate();
          return this.request(endpoint, options);
        }
        throw new AmazonAPIError('API_ERROR', response.statusText);
      }
      return response.json();
    }
  }
  
  // Performance Tracker for measuring execution time
  class PerformanceTracker {
    private metrics = new Map<string, number[]>();
    start(operation: string): void {
      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, []);
      }
      this.metrics.get(operation).push(Date.now());
    }
    end(operation: string): number {
      const times = this.metrics.get(operation);
      if (!times || times.length === 0) return 0;
      const startTime = times.pop();
      const duration = Date.now() - startTime;
      logger.info(`Operation ${operation} took ${duration}ms`);
      return duration;
    }
    getStats(): { [key: string]: { avg: number; count: number } } {
      const stats = {};
      this.metrics.forEach((times, operation) => {
        const total = times.reduce((sum, time) => sum + time, 0);
        stats[operation] = { avg: total / times.length, count: times.length };
      });
      return stats;
    }
  }
  
  export default AmazonMarketplace;