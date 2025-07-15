// Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): 2025-04-28 23:00:37
// Current User's Login: Mark-Lasfar

import mongoose, { Document, Schema } from 'mongoose'

export interface INotification extends Document {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  channels: NotificationChannel[]
  status: NotificationStatus
  priority: NotificationPriority
  read: boolean
  readAt?: Date
  expiresAt?: Date
  metadata?: {
    browser?: string
    device?: string
    ip?: string
  }
  createdAt: Date
  updatedAt: Date
}

export type NotificationType = 
| 'welcome'
| 'order created'
| 'order updated'
| 'order fulfilled'
| 'order cancelled'
| 'order shipped'
| 'order delivered'
| 'product imported' // إضافة نوع جديد
| 'order payment completed'
| 'order shipment updated'
| 'payment success'
| 'payment failed'
| 'product created'
| 'product updated'
| 'product deleted'
| 'product published'
| 'product unpublished'
| 'product reviewed'
| 'inventory updated'
| 'customer created'
| 'customer updated'
| 'seller registered'
| 'seller updated'
| 'withdrawal created'
| 'withdrawal updated'
| 'tax transaction created'
| 'campaign updated'
| 'ad performance updated'
| 'transaction recorded'
| 'analytics updated'
| 'automation triggered'
| 'message sent'
| 'course updated'
| 'security alert'
| 'account suspended'
| 'profile updated'
| 'settings updated'
| 'document uploaded'
| 'integration updated'
| 'earnings distributed'
| 'api_key created'
| 'api_key rotated'
| 'api_key deactivated'
| 'points earned'
| 'points updated'
| 'trial reminder'
| 'subscription expired'
| 'cart updated'
| 'promotion'
| 'verification'
| 'registration'
| 'product_status_updated'
| 'subscription_updated'
| 'reset password';



export type NotificationChannel = 'email' | 'push' | 'sms' | 'in_app'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

const notificationSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'welcome',
        'order created',
        'order updated',
        'order fulfilled',
        'order cancelled',
        'order shipped',
        'order delivered',
        'order payment completed',
        'order shipment updated',
        'payment success',
        'payment failed',
        'product created',
        'product updated',
        'product deleted',
        'product published',
        'product unpublished',
        'product reviewed',
        'inventory updated',
        'customer created',
        'customer updated',
        'seller registered',
        'seller updated',
        'withdrawal created',
        'withdrawal updated',
        'tax transaction created',
        'campaign updated',
        'ad performance updated',
        'transaction recorded',
        'analytics updated',
        'automation triggered',
        'message sent',
        'course updated',
        'security alert',
        'account suspended',
        'profile updated',
        'settings updated',
        'document uploaded',
        'integration updated',
        'earnings distributed',
        'api_key created',
        'api_key rotated',
        'api_key deactivated',
        'points earned',
        'points updated',
        'trial reminder',
        'subscription expired',
        'cart updated',
        'promotion',
        'verification',
        'reset password',
      'subscription_updated',

      ],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    channels: [{
      type: String,
      enum: ['email', 'push', 'sms', 'in_app'],
      default: ['email'],
    }],
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'cancelled'],
      default: 'pending',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    metadata: {
      browser: String,
      device: String,
      ip: String,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ status: 1, priority: 1 })
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Methods
notificationSchema.methods.markAsRead = function() {
  this.read = true
  this.readAt = new Date()
  return this.save()
}

notificationSchema.methods.markAsSent = function() {
  this.status = 'sent'
  return this.save()
}

// Statics
notificationSchema.statics.findByUser = function(userId: string) {
  return this.find({ userId }).sort({ createdAt: -1 })
}

notificationSchema.statics.findUnread = function(userId: string) {
  return this.find({ userId, read: false }).sort({ createdAt: -1 })
}

// Middleware
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    // Set default expiration to 30 days
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }
  next()
})

export default mongoose.models.Notification || 
  mongoose.model<INotification>('Notification', notificationSchema)