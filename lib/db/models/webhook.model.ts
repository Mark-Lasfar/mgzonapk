import mongoose, { Schema, model, Document, Model } from 'mongoose';
import { WebhookConfig, WebhookEvent } from '@/lib/types';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import crypto from 'crypto';

// تعريف المخطط
const webhookSchema = new Schema<WebhookConfig>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true,
    },
    url: {
      type: String,
      required: [true, 'Webhook URL is required'],
      trim: true,
      match: [/^https?:\/\/.*/, 'Please provide a valid URL'],
    },
    events: [
      {
        type: String,
        enum: {
          values: [
    'order created',
    'order fulfilled',
    'order cancelled',
    'order payment completed',
    'order shipment updated',
    'order updated',
    'payment succeeded',
    'shipment updated',
    'tax transaction created',
    'tax report created',
    'product created',
    'product updated',
    'product deleted',
    'product imported',
    'product synced',
    'inventory updated',
    'customer created',
    'customer updated',
    'withdrawal created',
    'withdrawal updated',
    'seller registered',
    'seller updated',
    'campaign updated',
    'ad performance updated',
    'transaction recorded',
    'analytics updated',
    'automation triggered',
    'message sent',
    'course updated',
    'security alert'

          ] as WebhookEvent[],
          message: '{VALUE} is not a supported webhook event',
        },
      },
    ],
    secret: {
      type: String,
      required: [true, 'Secret is required'],
      trim: true,
      set: (value: string) => (value ? encrypt(value) : undefined),
      get: (value: string) => (value ? decrypt(value) : undefined),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastTriggered: {
      type: Date,
    },
    lastError: {
      type: String,
      trim: true,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: [0, 'Retry count cannot be negative'],
    },
    headers: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

// إنشاء سر عشوائي إذا لم يتم توفيره
webhookSchema.pre('save', function (next) {
  if (this.isNew && !this.secret) {
    this.secret = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// إعداد الفهرسة
webhookSchema.index({ userId: 1, events: 1 });

// إنشاء النموذج
const Webhook: Model<WebhookConfig> = mongoose.models.Webhook || model<WebhookConfig>('Webhook', webhookSchema);

export default Webhook;