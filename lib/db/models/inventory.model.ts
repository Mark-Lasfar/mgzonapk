import { Schema, model, Document } from 'mongoose';

export interface InventoryItem {
  sku: string;
  provider: string;
  quantity: number;
  thresholds: {
    low: number;
  };
  metadata: Record<string, any>;
  lastSyncedAt: Date;
  adjustments: Array<{
    type: 'increase' | 'decrease' | 'set';
    quantity: number;
    timestamp: Date;
  }>;
}

interface InventoryItemDocument extends InventoryItem, Document {}

const inventorySchema = new Schema<InventoryItemDocument>(
  {
    sku: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0 },
    thresholds: {
      low: { type: Number, required: true, default: 10 },
    },
    metadata: { type: Object, default: {} },
    lastSyncedAt: { type: Date, required: true },
    adjustments: [
      {
        type: { type: String, enum: ['increase', 'decrease', 'set'], required: true },
        quantity: { type: Number, required: true },
        timestamp: { type: Date, required: true, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const InventoryModel = model<InventoryItemDocument>('Inventory', inventorySchema);

export default InventoryModel;