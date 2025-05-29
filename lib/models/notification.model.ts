import mongoose, { Document, Schema } from 'mongoose'

/**
 * Interface for Notification document
 */
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
  markAsRead: () => Promise<INotification>
  markAsSent: () => Promise<INotification>
  markAsQueued: () => Promise<INotification>
}

/**
 * Allowed notification types
 */
export type NotificationType =
  | 'welcome'
  | 'order_created'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'payment_success'
  | 'payment_failed'
  | 'alert'
  | 'verification'
  | 'reset_password'
  | 'security_alert'
  | 'promotion'
  | 'cart_updated'
  | 'product_reviewed'

/**
 * Allowed notification channels
 */
export type NotificationChannel = 'email' | 'push' | 'sms' | 'in_app'

/**
 * Notification status values
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'queued' | 'read'

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

const notificationSchema = new Schema<INotification>(
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
        'order_created',
        'order_shipped',
        'order_delivered',
        'order_cancelled',
        'payment_success',
        'payment_failed',
        'alert',
        'verification',
        'reset_password',
        'security_alert',
        'promotion',
        'cart_updated',
        'product_reviewed',
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
      enum: ['pending', 'sent', 'failed', 'queued', 'read'],
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
notificationSchema.index({ type: 1 })
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

// Methods
notificationSchema.methods.markAsRead = function() {
  this.read = true
  this.readAt = new Date()
  this.status = 'read'
  return this.save()
}

notificationSchema.methods.markAsSent = function() {
  this.status = 'sent'
  return this.save()
}

notificationSchema.methods.markAsQueued = function() {
  this.status = 'queued'
  this.queuedAt = new Date()
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
    // Set default expiration to 90 days
    this.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  }
  next()
})

export default mongoose.models.Notification || 
  mongoose.model<INotification>('Notification', notificationSchema)