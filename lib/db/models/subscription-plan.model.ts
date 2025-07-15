import mongoose, { Schema, Document, Model } from 'mongoose';
import validator from 'validator';

export interface ISubscriptionPlan extends Document {
  id: string;
  name: string; // ديناميكي عشان الأدمن يضيف أي اسم
  price: number;
  pointsCost: number;
  currency: string;
  description: string;
  features: {
    productsLimit: number;
    commission: number;
    prioritySupport: boolean;
    instantPayouts: boolean;
    customSectionsLimit: number;
    domainSupport: boolean;
    domainRenewal: boolean;
    pointsRedeemable: boolean;
    dynamicPaymentGateways: boolean;
    maxApiKeys: number;
  };
  isTrial: boolean;
  trialDuration?: number;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPlanSchema: Schema<ISubscriptionPlan> = new Schema(
  {
    id: {
      type: String,
      required: [true, 'Plan ID is required'],
      unique: true,
      trim: true,
      validate: {
        validator: (v: string) => /^[a-z0-9_-]+$/.test(v),
        message: 'Plan ID must contain only lowercase letters, numbers, underscores, or hyphens',
      },
    },
    name: {
      type: String,
      required: [true, 'Plan name is required'],
      trim: true,
      minlength: [2, 'Plan name must be at least 2 characters'],
      maxlength: [50, 'Plan name cannot exceed 50 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    pointsCost: {
      type: Number,
      required: [true, 'Points cost is required'],
      min: [0, 'Points cost cannot be negative'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    features: {
      productsLimit: { type: Number, required: true, min: 0 },
      commission: { type: Number, required: true, min: 0 },
      prioritySupport: { type: Boolean, default: false },
      instantPayouts: { type: Boolean, default: false },
      customSectionsLimit: { type: Number, default: 0, min: 0 },
      domainSupport: { type: Boolean, default: false },
      domainRenewal: { type: Boolean, default: false },
      pointsRedeemable: { type: Boolean, default: false },
      dynamicPaymentGateways: { type: Boolean, default: false },
      maxApiKeys: { type: Number, default: 1, min: 0 }, // أضفت هذا
      _id: false,
    },
    isTrial: { type: Boolean, default: false },
    trialDuration: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

SubscriptionPlanSchema.index({ id: 1 }, { unique: true });
SubscriptionPlanSchema.index({ isActive: 1 });

const SubscriptionPlan: Model<ISubscriptionPlan> =
  mongoose.models.SubscriptionPlan ||
  mongoose.model<ISubscriptionPlan>('SubscriptionPlan', SubscriptionPlanSchema);

export default SubscriptionPlan;