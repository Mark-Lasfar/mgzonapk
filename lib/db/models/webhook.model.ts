import { Schema, model, models } from 'mongoose'
import { WebhookConfig, WebhookEvent } from '@/lib/api/types'
import crypto from 'crypto'

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
            'order.created',
            'order.updated',
            'order.fulfilled',
            'order.cancelled',
            'product.created',
            'product.updated',
            'product.deleted',
            'inventory.updated',
            'customer.created',
            'customer.updated',
            'withdrawal.created',
            'withdrawal.updated',
            'seller.registered',
            'seller.updated',
          ] as WebhookEvent[],
          message: '{VALUE} is not a supported webhook event',
        },
      },
    ],
    secret: {
      type: String,
      required: [true, 'Secret is required'],
      trim: true,
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
  },
  {
    timestamps: true,
  }
)

webhookSchema.pre('save', function (next) {
  if (this.isNew) {
    this.secret = crypto.randomBytes(32).toString('hex')
  }
  next()
})

const Webhook = models.Webhook || model<WebhookConfig>('Webhook', webhookSchema)

export default Webhook