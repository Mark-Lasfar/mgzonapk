export interface InventoryItem {
    sku: string;
    productId: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    warehouseId: string;
    provider: string;
    lastSyncedAt: Date;
    thresholds: {
      low: number;
      reorder: number;
      max: number;
    };
    metadata: Record<string, any>;
  }
  
  export interface InventorySync {
    id: string;
    provider: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt: Date;
    completedAt?: Date;
    itemsProcessed: number;
    totalItems: number;
    errors: Array<{
      sku: string;
      error: string;
      timestamp: Date;
    }>;
  }
  
  export interface InventoryAdjustment {
    sku: string;
    quantity: number;
    type: 'increase' | 'decrease' | 'set';
    reason: string;
    reference?: string;
    userId: string;
    timestamp: Date;
  }