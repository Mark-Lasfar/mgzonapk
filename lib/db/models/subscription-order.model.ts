import { Schema, model, models, Document } from 'mongoose'

export interface ISubscriptionOrder extends Document {
  userId: string
  planId: string
  amount: number
  currency: string
  paymentMethod: 'stripe' | 'paypal'
  isPaid: boolean
  paidAt?: Date
  paymentResult?: {
    id: string
    status: string
    update_time?: string
    email_address?: string
  }
  createdAt: Date
  updatedAt: Date
}

const subscriptionOrderSchema = new Schema<ISubscriptionOrder>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
    },
    planId: {
      type: String,
      required: [true, 'Plan ID is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['stripe', 'paypal'],
        message: '{VALUE} is not a valid payment method',
      },
      required: [true, 'Payment method is required'],
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    paymentResult: {
      id: { type: String },
      status: { type: String },
      update_time: { type: String },
      email_address: { type: String },
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
  {
    timestamps: true,
  }
)

subscriptionOrderSchema.index({ userId: 1, createdAt: -1 });
subscriptionOrderSchema.index({ planId: 1 });
subscriptionOrderSchema.index({ isPaid: 1 });

const SubscriptionOrder = models.SubscriptionOrder || model<ISubscriptionOrder>('SubscriptionOrder', subscriptionOrderSchema)

export default SubscriptionOrder