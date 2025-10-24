import mongoose, { Schema, Document, Model } from 'mongoose';
import validator from 'validator';
import { v4 as uuidv4 } from 'uuid';

export interface ISubscriptionPlan extends Document {
  id: string;
  name: string;
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
    analyticsAccess:boolean;
    abTesting: boolean;
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
      default: uuidv4, // إنشاء UUID تلقائيًا إذا لم يتم توفيره
      validate: {
        validator: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
        message: 'Plan ID must be a valid UUID',
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
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      default: 'USD',
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
  analyticsAccess: { type: Boolean, required: true, default: false },
  pointsRedeemable: { type: Boolean, default: false },
  dynamicPaymentGateways: { type: Boolean, default: false },
  maxApiKeys: { type: Number, default: 1, min: 0 },
  abTesting: { type: Boolean, required: true, default: false },
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