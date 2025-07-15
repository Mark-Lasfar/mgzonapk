// /home/hager/Trash/my-nextjs-project-master/lib/db/models/sellerIntegration.model.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import validator from 'validator';
import { encrypt, decrypt } from '@/lib/utils/encryption';

export interface ISellerIntegration extends Document {
  sellerId: Types.ObjectId;
  integrationId: Types.ObjectId;
  accessToken?: string;
  refreshToken?: string;
  accountDetails: Map<string, string>;
  expiresAt?: Date;
  isActive: boolean;
  lastUpdated: Date;
  status: 'connected' | 'disconnected' | 'expired' | 'needs_reauth';
  lastConnectedAt?: Date;
  updatedBy: Types.ObjectId;
  metadata: Record<string, any>;
  sandboxMode: boolean;
  connectionDetails?: {
    ipAddress?: string;
    userAgent?: string;
  };
  connectedBy: Types.ObjectId;
  connectedByRole: 'seller' | 'admin' | 'user' | 'employee';
  connectionType: 'oauth' | 'manual';
  description?: string;
  webhook?: {
    enabled: boolean;
    url?: string;
    events?: Array<
  | 'order created'
  | 'order fulfilled'
  | 'order cancelled'
  | 'order payment completed'
  | 'order shipment updated'
  | 'order updated'
  | 'payment succeeded'
  | 'shipment updated'
  | 'tax transaction created'
  | 'tax report created'
  | 'product created'
  | 'product updated'
  | 'product deleted'
  | 'product imported'
  | 'product synced'
  | 'inventory updated'
  | 'customer created'
  | 'customer updated'
  | 'withdrawal created'
  | 'withdrawal updated'
  | 'seller registered'
  | 'seller updated'
  | 'campaign updated'
  | 'ad performance updated'
  | 'transaction recorded'
  | 'analytics updated'
  | 'automation triggered'
  | 'message sent'
  | 'course updated'
  | 'security alert'

    >;
    secret?: string;
  };
  apiEndpoints?: Map<string, string>;
  credentials?: Map<string, string>;
  history: {
    event: 'connected' | 'disconnected' | 'refreshed' | 'error' | 'updated';
    date: Date;
    message?: string;
  }[];
}

const sellerIntegrationSchema = new Schema<ISellerIntegration>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: [true, 'Seller ID is required'],
      index: true,
    },
    integrationId: {
      type: Schema.Types.ObjectId,
      ref: 'Integration',
      required: [true, 'Integration ID is required'],
      index: true,
    },
    accessToken: {
      type: String,
      get: (val: string | undefined) => (val ? decrypt(val) : undefined),
      set: (val: string | undefined) => (val ? encrypt(val) : undefined),
    },
    refreshToken: {
      type: String,
      get: (val: string | undefined) => (val ? decrypt(val) : undefined),
      set: (val: string | undefined) => (val ? encrypt(val) : undefined),
    },
    accountDetails: {
      type: Map,
      of: String,
      default: {},
      set: (val: Map<string, string>) => {
        const encrypted = new Map<string, string>();
        val.forEach((value, key) => {
          encrypted.set(key, value ? encrypt(value) : value);
        });
        return encrypted;
      },
      get: (val: Map<string, string>) => {
        const decrypted = new Map<string, string>();
        val.forEach((value, key) => {
          decrypted.set(key, value ? decrypt(value) : value);
        });
        return decrypted;
      },
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'expired', 'needs_reauth'],
      default: 'disconnected',
    },
    lastConnectedAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sandboxMode: {
      type: Boolean,
      default: false,
    },
    connectionDetails: {
      ipAddress: { type: String, validate: { validator: validator.isIP, message: 'Invalid IP address' } },
      userAgent: { type: String },
      _id: false,
    },
    connectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: [true, 'Connected by is required'],
    },
    connectedByRole: {
      type: String,
      enum: ['seller', 'admin', 'user', 'employee'],
      required: [true, 'Connected by role is required'],
    },
    connectionType: {
      type: String,
      enum: ['oauth', 'manual'],
      required: [true, 'Connection type is required'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    webhook: {
      enabled: { type: Boolean, default: false },
      url: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
          message: 'Webhook URL must be a valid HTTPS URL',
        },
      },
      events: [
        {
          type: String,
          enum: [
    'order created',
    'order fulfilled',
    'order cancelled',
    'order payment completed',
    'order shipment updated',
    'order updated',
    'payment succeeded',
    'shipment updated',
    'tax transaction created',
    'tax report created',
    'product created',
    'product updated',
    'product deleted',
    'product imported',
    'product synced',
    'inventory updated',
    'customer created',
    'customer updated',
    'withdrawal created',
    'withdrawal updated',
    'seller registered',
    'seller updated',
    'campaign updated',
    'ad performance updated',
    'transaction recorded',
    'analytics updated',
    'automation triggered',
    'message sent',
    'course updated',
    'security alert'

          ],
        },
      ],
      secret: {
        type: String,
        get: (val: string | undefined) => (val ? decrypt(val) : undefined),
        set: (val: string | undefined) => (val ? encrypt(val) : undefined),
      },
      _id: false,
    },
    apiEndpoints: {
      type: Map,
      of: {
        type: String,
        validate: {
          validator: (v: string) => validator.isURL(v, { protocols: ['https'] }) || v.startsWith('/'),
          message: 'API endpoint URL must be a valid HTTPS URL or a relative path',
        },
      },
      default: {},
    },
    credentials: {
      type: Map,
      of: {
        type: String,
        get: (val: string | undefined) => (val ? decrypt(val) : undefined),
        set: (val: string | undefined) => (val ? encrypt(val) : undefined),
      },
      default: {},
    },
    history: [
      {
        event: {
          type: String,
          enum: ['connected', 'disconnected', 'refreshed', 'error', 'updated'],
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        message: {
          type: String,
          trim: true,
        },
        _id: false,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

sellerIntegrationSchema.pre('save', async function (next) {
  const Integration = mongoose.model('Integration');
  if (this.isNew || this.isModified('isActive')) {
    await Integration.updateOne(
      { _id: this.integrationId },
      {
        $set: {
          enabledBySellers: this.isActive
            ? { $addToSet: { enabledBySellers: this.sellerId } }
            : { $pull: { enabledBySellers: this.sellerId } },
        },
      }
    );
  }
  next();
});

sellerIntegrationSchema.index({ sellerId: 1, integrationId: 1, sandboxMode: 1 }, { unique: true });

const SellerIntegration: Model<ISellerIntegration> =
  mongoose.models.SellerIntegration || mongoose.model<ISellerIntegration>('SellerIntegration', sellerIntegrationSchema);

export default SellerIntegration;