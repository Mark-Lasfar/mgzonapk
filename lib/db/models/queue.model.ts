import { Schema, model, models } from 'mongoose';

export interface IQueue {
  taskType: string;
  payload: Record<string, any>;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  nextRetryAt: Date;
  attempts: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const queueSchema = new Schema<IQueue>(
  {
    taskType: {
      type: String,
      required: [true, 'Task type is required'],
      enum: {
        values: [
          'webhook retry',
          'order processing',
          'tax calculation',
          'inventory sync',
          'shipment update',
          'recommendation training',
          'warehouse sync',
          'payment processing',
          'marketing campaign',
          'analytics update',
        ],
        message: '{VALUE} is not a supported task type',
      },
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: [true, 'Payload is required'],
    },
    priority: {
      type: Number,
      required: [true, 'Priority is required'],
      min: [1, 'Priority must be at least 1'],
      max: [10, 'Priority cannot exceed 10'],
      default: 5,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    nextRetryAt: {
      type: Date,
      required: [true, 'Next retry time is required'],
    },
    attempts: {
      type: Number,
      required: [true, 'Attempts is required'],
      min: [0, 'Attempts cannot be negative'],
      default: 0,
    },
    error: {
      type: String,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

queueSchema.index({ nextRetryAt: 1, priority: -1 });
queueSchema.index({ status: 1 });

const Queue = models.Queue || model<IQueue>('Queue', queueSchema);
export default Queue;