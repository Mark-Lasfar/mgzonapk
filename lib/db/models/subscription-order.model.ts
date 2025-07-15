import mongoose, { Schema, Document, Model } from 'mongoose';

interface ISubscriptionOrder extends Document {
  userId: string;
  planId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentGatewayId?: mongoose.Types.ObjectId;
  pointsRedeemed?: number;
  isPaid: boolean;
  paidAt?: Date;
  paymentResult?: {
    id: string;
    status?: string;
    update_time?: string;
    email_address?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionOrderSchema: Schema<ISubscriptionOrder> = new Schema(
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
      uppercase: true,
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
    },
    paymentGatewayId: {
      type: Schema.Types.ObjectId,
      ref: 'Integration',
    },
    pointsRedeemed: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    paymentResult: {
      id: { type: String, trim: true },
      status: { type: String, trim: true },
      update_time: { type: String, trim: true },
      email_address: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

SubscriptionOrderSchema.index({ userId: 1, createdAt: -1 });
SubscriptionOrderSchema.index({ planId: 1 });
SubscriptionOrderSchema.index({ isPaid: 1 });
SubscriptionOrderSchema.index({ paymentGatewayId: 1 });

const SubscriptionOrder: Model<ISubscriptionOrder> =
  mongoose.models.SubscriptionOrder ||
  mongoose.model<ISubscriptionOrder>('SubscriptionOrder', SubscriptionOrderSchema);

export default SubscriptionOrder;