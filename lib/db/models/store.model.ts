import { Schema, model, models, Document } from 'mongoose';
import { Types } from 'mongoose';

interface IStore extends Document {
  storeId: string;
  sellerId: Types.ObjectId;
  name: string;
  domain?: string;
  platform: string;
  credentials?: {
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    awsAccessKey?: string;
    awsSecretKey?: string;
    roleArn?: string;
    shopDomain?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const storeSchema = new Schema<IStore>(
  {
    storeId: {
      type: String,
      required: [true, 'Store ID is required'],
      unique: true,
      trim: true,
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      minlength: [2, 'Store name must be at least 2 characters'],
      maxlength: [100, 'Store name cannot exceed 100 characters'],
    },
    domain: {
      type: String,
      trim: true,
      match: [/^https?:\/\/[^\s/$.?#].[^\s]*$/, 'Please provide a valid URL'],
    },
    platform: {
      type: String,
      enum: {
        values: ['shopify', 'aliexpress', 'amazon', 'custom'],
        message: '{VALUE} is not a valid platform',
      },
      required: [true, 'Platform is required'],
    },
    credentials: {
      accessToken: { type: String, trim: true },
      refreshToken: { type: String, trim: true },
      clientId: { type: String, trim: true },
      clientSecret: { type: String, trim: true },
      awsAccessKey: { type: String, trim: true },
      awsSecretKey: { type: String, trim: true },
      roleArn: { type: String, trim: true },
      shopDomain: { type: String, trim: true },
    },
    isActive: {
      type: Boolean,
      default: true,
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
);

storeSchema.index({ storeId: 1 }, { unique: true });
storeSchema.index({ sellerId: 1, isActive: 1 });

const Store = models.Store || model<IStore>('Store', storeSchema);
export default Store;