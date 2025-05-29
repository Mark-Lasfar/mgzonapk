import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface IApiKey extends Document {
  name: string;
  key: string;
  secret: string;
  permissions: string[];
  isActive: boolean;
  expiresAt?: Date;
  lastUsed?: Date;
  createdBy: string;
  updatedBy: string;
  sellerId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  isExpired(): boolean;
  hasPermission(permission: string): boolean;
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
      default: () => crypto.randomBytes(32).toString('hex'),
    },
    secret: {
      type: String,
      required: [true, 'Secret is required'],
      default: () => crypto.randomBytes(64).toString('hex'),
    },
    permissions: [
      {
        type: String,
        required: [true, 'Permission is required'],
        trim: true,
        enum: {
          values: [
            'products:read', 'products:write',
            'orders:read', 'orders:write',
            'customers:read', 'customers:write',
            'inventory:read', 'inventory:write',
            'analytics:read'
          ],
          message: 'Invalid permission: {VALUE}',
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
      type: String,
      required: [true, 'Created by is required'],
    },
    updatedBy: {
      type: String,
      required: [true, 'Updated by is required'],
    },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
apiKeySchema.index({ key: 1 }, { unique: true });
apiKeySchema.index({ isActive: 1 });
apiKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });
apiKeySchema.index({ sellerId: 1 });

// Middleware
apiKeySchema.pre('save', function (next) {
  if (this.isNew) {
    this.createdBy = this.createdBy || 'system';
  }
  this.updatedBy = this.updatedBy || 'system';
  next();
});

apiKeySchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  const update = this.getUpdate() as any;
  if (update) {
    update.updatedBy = update.updatedBy || 'system';
    update.updatedAt = new Date();
  }
  next();
});

// Methods
apiKeySchema.methods.isExpired = function (): boolean {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

apiKeySchema.methods.hasPermission = function (permission: string): boolean {
  return this.permissions.includes(permission);
};

apiKeySchema.methods.updateLastUsed = async function (): Promise<void> {
  await this.updateOne({ lastUsed: new Date() });
};

const ApiKey: Model<IApiKey> =
  mongoose.models.ApiKey || mongoose.model<IApiKey>('ApiKey', apiKeySchema);

export default ApiKey;