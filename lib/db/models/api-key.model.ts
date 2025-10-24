import { Schema, model, models, Document, Types } from 'mongoose';
import crypto from 'crypto';

export type ApiPermission =
  | 'products:read'
  | 'products:write'
  | 'orders:read'
  | 'orders:write'
  | 'customers:read'
  | 'customers:write'
  | 'inventory:read'
  | 'inventory:write'
  | 'analytics:read';

export interface IApiKey extends Document {
  name: string;
  key: string;
  secret: string;
  permissions: ApiPermission[];
  isActive: boolean;
  expiresAt?: Date;
  lastUsed?: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  sellerId: Types.ObjectId;
  userId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  isExpired(): boolean;
  hasPermission(permission: ApiPermission): boolean;
  updateLastUsed(): Promise<void>;
}

const apiKeySchema = new Schema<IApiKey>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    key: {
      type: String,
      required: [true, 'Key is required'],
      unique: true,
      default: () => `mgz_${crypto.randomBytes(16).toString('hex')}`,
    },
    secret: {
      type: String,
      required: [true, 'Secret is required'],
      default: () => crypto.randomBytes(32).toString('hex'),
    },
    permissions: [
      {
        type: String,
        required: [true, 'Permission is required'],
enum: {
  values: [
    'profile:read',
    'profile:write',
    'products:read',
    'products:write',
    'orders:read',
    'orders:write',
    'customers:read',
    'customers:write',
    'inventory:read',
    'inventory:write',
    'analytics:read',
  ],
  message: '{VALUE} is not a valid permission',
},

      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: {
      type: Date,
    },
    lastUsed: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by is required'],
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Updated by is required'],
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

apiKeySchema.index({ key: 1 }, { unique: true });
apiKeySchema.index({ sellerId: 1, isActive: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

apiKeySchema.pre('save', function (next) {
  if (!this.createdBy) this.createdBy = this.userId || this.sellerId;
  if (!this.updatedBy) this.updatedBy = this.userId || this.sellerId;
  next();
});

apiKeySchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  this.set({ updatedBy: this.get('updatedBy') || this.get('userId') || this.get('sellerId'), updatedAt: new Date() });
  next();
});

apiKeySchema.methods.isExpired = function (): boolean {
  return !!this.expiresAt && new Date() > this.expiresAt;
};

apiKeySchema.methods.hasPermission = function (permission: ApiPermission): boolean {
  return this.permissions.includes(permission);
};

apiKeySchema.methods.updateLastUsed = async function (): Promise<void> {
  await this.updateOne({ lastUsed: new Date() });
};

const ApiKey = models.ApiKey || model<IApiKey>('ApiKey', apiKeySchema);
export default ApiKey;