import { Document, Model, model, models, Schema } from 'mongoose'

export type NotificationType = 
  | 'welcome'
  | 'order'
  | 'payment'
  | 'shipping'
  | 'account'
  | 'product'
  | 'security'
  | 'system'

export type NotificationChannel = 'email' | 'push' | 'sms' | 'in_app'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read'

export interface INotification extends Document {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  channels: NotificationChannel[]
  priority: NotificationPriority
  status: NotificationStatus
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
  markAsRead(): Promise<void>
  markAsSent(): Promise<void>
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'welcome',
        'order',
        'payment',
        'shipping',
        'account',
        'product',
        'security',
        'system',
      ],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    channels: {
      type: [String],
      enum: ['email', 'push', 'sms', 'in_app'],
      default: ['email'],
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'read'],
      default: 'pending',
    },
    read: { type: Boolean, default: false },
    readAt: Date,
    expiresAt: Date,
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

// Add methods to the schema
notificationSchema.methods.markAsRead = async function () {
  this.read = true
  this.readAt = new Date()
  this.status = 'read'
  await this.save()
}

notificationSchema.methods.markAsSent = async function () {
  this.status = 'sent'
  await this.save()
}

// Add indexes
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ status: 1 })
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const Notification = (models.Notification as Model<INotification>) || 
  model<INotification>('Notification', notificationSchema)

export default Notification