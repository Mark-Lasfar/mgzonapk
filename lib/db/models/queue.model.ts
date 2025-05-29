import mongoose, { Schema, Document } from 'mongoose';

export interface IQueue extends Document {
  taskType: 'order_processing' | 'inventory_update' | 'recommendation_training' | 'warehouse_sync';
  payload: any;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processingAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  retries?: number;
  nextRetryAt?: Date;
  error?: string;
}

const QueueSchema: Schema = new Schema({
  taskType: {
    type: String,
    enum: ['order_processing', 'inventory_update', 'recommendation_training', 'warehouse_sync'],
    required: true,
  },
  payload: {
    type: Schema.Types.Mixed,
    required: true,
  },
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  processingAt: {
    type: Date,
  },
  completedAt: {
    type: Date,
  },
  failedAt: {
    type: Date,
  },
  retries: {
    type: Number,
    default: 0,
  },
  nextRetryAt: {
    type: Date,
  },
  error: {
    type: String,
  },
});

export default mongoose.models.Queue || mongoose.model<IQueue>('Queue', QueueSchema);