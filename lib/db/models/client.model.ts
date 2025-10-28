import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';
import validator from 'validator';

export interface IClient extends Document {
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  isMarketplaceApp: boolean;
  customScopes?: string[];
  createdBy: string;
  updatedBy: string;
  isActive: boolean;
  status: 'pending' | 'approved' | 'rejected';
  commissionRate?: number;
  description?: string;
  logoUrl?: string;
  videos?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  images?: Array<{ url: string; position: 'left' | 'center' | 'right'; size: 'small' | 'medium' | 'large' }>;
  buttons?: Array<{ label: string; link: string; type: 'primary' | 'secondary' | 'link' }>;
  features?: string[];
  categories?: string[];
  rating?: number;
  ratingsCount?: number;
  installs?: number;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new Schema<IClient>(
  {
    name: {
      type: String,
      required: [true, 'Application name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    clientId: {
      type: String,
      required: [true, 'Client ID is required'],
      unique: true,
      default: () => `mgzon_${crypto.randomBytes(16).toString('hex')}`,
    },
    isMarketplaceApp: {
      type: Boolean,
      default: false,
    },
    clientSecret: {
      type: String,
      required: [true, 'Client Secret is required'],
      default: () => crypto.randomBytes(32).toString('hex'),
    },

    redirectUris: [
      {
        type: String,
        required: [true, 'Redirect URI is required'],
        trim: true,
        validate: {
          validator: (uri: string) => /^https?:\/\/.+$/.test(uri),
          message: 'Invalid redirect URI format',
        },
      },
    ],
    scopes: [
      {
        type: String,
        required: [true, 'Scope is required'],
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
          message: 'Invalid scope: {VALUE}',
        },
      },
    ],
    customScopes: [
      {
        type: String,
        trim: true,
        validate: {
          validator: (scope: string) => /^[a-zA-Z0-9:]+$/.test(scope),
          message: 'Invalid custom scope format',
        },
      },
    ],
    createdBy: {
      type: String,
      required: [true, 'Created by is required'],
    },
    updatedBy: {
      type: String,
      required: [true, 'Updated by is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: function () {
        return this.isMarketplaceApp ? 'pending' : 'approved';
      },
    },
    commissionRate: {
      type: Number,
      min: [0, 'Commission rate cannot be negative'],
      max: [1, 'Commission rate cannot exceed 100%'],
      default: 0,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    logoUrl: {
      type: String,
      trim: true,
      validate: {
        validator: (url: string) => !url || /^https?:\/\/.+$/.test(url),
        message: 'Invalid logo URL format',
      },
    },
    videos: [
      {
        url: {
          type: String,
          required: true,
          validate: {
            validator: (url: string) => /^https?:\/\/.+$/.test(url),
            message: 'Invalid video URL format',
          },
        },
        position: {
          type: String,
          enum: ['left', 'center', 'right'],
          default: 'center',
        },
        size: {
          type: String,
          enum: ['small', 'medium', 'large'],
          default: 'medium',
        },
      },
    ],
    images: [
      {
        url: {
          type: String,
          required: true,
          validate: {
            validator: (url: string) => /^https?:\/\/.+$/.test(url),
            message: 'Invalid image URL format',
          },
        },
        position: {
          type: String,
          enum: ['left', 'center', 'right'],
          default: 'center',
        },
        size: {
          type: String,
          enum: ['small', 'medium', 'large'],
          default: 'medium',
        },
      },
    ],
    buttons: [
      {
        label: {
          type: String,
          required: true,
          trim: true,
          minlength: [2, 'Button label must be at least 2 characters'],
        },
        link: {
          type: String,
          required: true,
          validate: {
            validator: (url: string) => /^https?:\/\/.+$/.test(url),
            message: 'Invalid button link format',
          },
        },
        type: {
          type: String,
          enum: ['primary', 'secondary', 'link'],
          default: 'primary',
        },
      },
    ],
    features: [
      {
        type: String,
        trim: true,
        maxlength: [200, 'Feature cannot exceed 200 characters'],
      },
    ],
    categories: [
      {
        type: String,
        enum: [
          'payment',
          'warehouse',
          'dropshipping',
          'marketplace',
          'shipping',
          'marketing',
          'accounting',
          'crm',
          'analytics',
          'automation',
          'communication',
          'education',
          'security',
          'advertising',
          'tax',
          'other',
        ],
      },
    ],
    rating: {
      type: Number,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
      default: 0,
    },
    ratingsCount: {
      type: Number,
      min: [0, 'Ratings count cannot be negative'],
      default: 0,
    },
    installs: {
      type: Number,
      min: [0, 'Installs count cannot be negative'],
      default: 0,
    },
    slug: {
      type: String,
      required: [true, 'Slug is required'],
      unique: true,
      trim: true,
      validate: {
        validator: (slug: string) => /^[a-z0-9-]+$/.test(slug),
        message: 'Invalid slug format',
      },
    },
  },
  {
    timestamps: true,
  }
);

clientSchema.index({ clientId: 1, slug: 1 }, { unique: true });
clientSchema.index({ isActive: 1, status: 1 });
clientSchema.index({ createdBy: 1 });

clientSchema.pre('save', function (next) {
  if (this.isNew) {
    this.createdBy = this.createdBy || 'system';
    this.slug = this.slug || this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  this.updatedBy = this.updatedBy || 'system';
  next();
});

clientSchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  const update = this.getUpdate() as any;
  if (update) {
    update.updatedBy = update.updatedBy || 'system';
    update.updatedAt = new Date();
  }
  next();
});

const Client: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>('Client', clientSchema);

export default Client;