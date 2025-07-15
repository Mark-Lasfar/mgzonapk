// /home/mark/Music/my-nextjs-project-clean/lib/db/models/integration.model.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import validator from 'validator';
import { encrypt, decrypt } from '@/lib/utils/encryption';
import { randomUUID } from 'crypto';

export interface IIntegration extends Document {
  providerName: string;
  type:
    | 'payment'
    | 'warehouse'
    | 'dropshipping'
    | 'marketplace'
    | 'shipping'
    | 'marketing'
    | 'accounting'
    | 'crm'
    | 'analytics'
    | 'automation'
    | 'communication'
    | 'education'
    | 'security'
    | 'advertising'
    | 'tax'
    | 'other';
  credentials: Map<string, string>;
  oauth: {
    enabled: boolean;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
  };
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
  autoRegister?: {
    enabled: boolean;
    fields: Array<{
      key: string;
      label: string;
      type: 'text' | 'password' | 'email' | 'number';
      required: boolean;
    }>;
  };
  apiEndpoints?: Map<string, string>;
  settings: {
    [x: string]: any;
    supportedCurrencies?: string[];
    supportedCountries?: string[];
    supportedCountryCodes?: string[];
    amountMultiplier: number;
    apiUrl?: string; // أضفتها
    baseUrl?: string; // أضفتها
    authType?: 'Bearer' | 'Basic' | 'APIKey' | 'OAuth';
    endpoints?: Map<string, string>;
    responseMapping?: Map<string, string>;
    sdk?: string;
    clientId?: string; // أضفتها
    clientSecret?: string; // أضفتها
    refreshTokenUrl?: string; // أضفتها
    retryOptions?: {
      maxRetries: number;
      initialDelay: number;
    };
  };
  pricing: {
    isFree: boolean;
    commissionRate?: number;
    requiredPlanIds?: Types.ObjectId[];
  };
  logoUrl?: string;
  description?: string;
  videos?: Array<{
    id: string;
    url: string;
    position: 'left' | 'center' | 'right';
    size: 'small' | 'medium' | 'large';
    fontSize?: string;
    fontFamily?: string;
    margin?: string;
    padding?: string;
    customPosition?: { position: 'absolute' | 'relative' | 'fixed'; top?: string; left?: string };
  }>;
  images?: Array<{
    id: string;
    url: string;
    position: 'left' | 'center' | 'right';
    size: 'small' | 'medium' | 'large';
    fontSize?: string;
    fontFamily?: string;
    margin?: string;
    padding?: string;
    customPosition?: { position: 'absolute' | 'relative' | 'fixed'; top?: string; left?: string };
  }>;
  articles?: Array<{
    id: string;
    title: string;
    content: string;
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    fontFamily?: string;
  }>;
  buttons?: Array<{
    id: string;
    label: string;
    link: string;
    type: 'primary' | 'secondary' | 'link';
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    padding?: string;
  }>;
  dividers?: Array<{
    id: string;
    style: string;
  }>;
  isActive: boolean;
  sandbox: boolean;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  history: Array<{ event: string; date: Date }>;
  enabledBySellers: Types.ObjectId[];
  connected: boolean;
  status: 'connected' | 'disconnected' | 'expired' | 'needs_reauth';
  accessToken?: string; // أضفتها
}

const integrationSchema = new Schema<IIntegration>(
  {
    providerName: {
      type: String,
      required: [true, 'Provider name is required'],
      unique: true,
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^[\w\s-]+$/.test(v),
        message: 'Invalid characters in provider name',
      },
    },
    type: {
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
      required: [true, 'Type is required'],
    },
    credentials: {
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
    oauth: {
      enabled: { type: Boolean, default: false },
      authorizationUrl: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
          message: 'Invalid URL format for authorization',
        },
      },
      tokenUrl: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
          message: 'Invalid URL format for token',
        },
      },
      scopes: [{ type: String, trim: true }],
    },
    webhook: {
      enabled: { type: Boolean, default: false },
      url: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
          message: 'Invalid URL format for webhook',
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
            'security alert',
          ],
        },
      ],
      secret: {
        type: String,
        set: (value: string) => (value ? encrypt(value) : undefined),
        get: (value: string) => (value ? decrypt(value) : undefined),
      },
    },
    autoRegister: {
      enabled: { type: Boolean, default: false },
      fields: [
        {
          key: { type: String, required: true, trim: true },
          label: { type: String, required: true, trim: true },
          type: { type: String, enum: ['text', 'password', 'email', 'number'], default: 'text' },
          required: { type: Boolean, default: true },
        },
      ],
    },
    apiEndpoints: {
      type: Map,
      of: {
        type: String,
        validate: {
          validator: (v: string) => validator.isURL(v, { protocols: ['https'] }) || /^\/api[\w/]+$/.test(v),
          message: 'Invalid URL or path format for API endpoint',
        },
      },
      default: {},
    },
    settings: {
      supportedCurrencies: [
        {
          type: String,
          trim: true,
          match: /^[A-Z]{3}$/,
          validate: {
            validator: (v: string) => ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SAR'].includes(v),
            message: 'Invalid currency code',
          },
        },
      ],
      supportedCountries: [
        {
          type: String,
          trim: true,
          match: /^[A-Z]{2}$/,
          validate: {
            validator: (v: string) => ['US', 'CA', 'GB', 'EU', 'AU', 'SA'].includes(v),
            message: 'Invalid country code',
          },
        },
      ],
      supportedCountryCodes: [
        {
          type: String,
          trim: true,
          match: /^[A-Z]{2}$/,
          validate: {
            validator: (v: string) => ['US', 'CA', 'GB', 'EU', 'AU', 'SA'].includes(v),
            message: 'Invalid currency code',
          },
        },
      ],
      amountMultiplier: { type: Number, default: 1 },
      apiUrl: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
          message: 'Invalid URL format for API',
        },
      },
      baseUrl: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
          message: 'Invalid URL format for baseUrl',
        },
      },
      authType: {
        type: String,
        enum: ['Bearer', 'Basic', 'APIKey', 'OAuth'],
      },
      endpoints: {
        type: Map,
        of: {
          type: String,
          validate: {
            validator: (v: string) => validator.isURL(v, { protocols: ['https'] }) || /^\/api[\w/]+$/.test(v),
            message: 'Invalid URL or path format for endpoint',
          },
        },
        default: {
          get: '/products/:id',
          sync: '/products/:id/sync',
          update: '/products/:id/update',
          remove: '/products/:id/remove',
          import: '/products/import',
          shipment: '/orders',
          shipmentStatus: '/shipments/:id',
          create: '/products',
          updateById: '/products/:externalId',
        },
      },
      responseMapping: {
        type: Map,
        of: String,
        default: {},
      },
      retryOptions: {
        maxRetries: { type: Number, default: 3 },
        initialDelay: { type: Number, default: 1000 },
      },
      sdk: { type: String, trim: true },
      clientId: {
        type: String,
        trim: true,
        set: (value: string) => (value ? encrypt(value) : undefined),
        get: (value: string) => (value ? decrypt(value) : undefined),
      },
      clientSecret: {
        type: String,
        set: (value: string) => (value ? encrypt(value) : undefined),
        get: (value: string) => (value ? decrypt(value) : undefined),
      },
      refreshTokenUrl: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
          message: 'Invalid URL format for refreshTokenUrl',
        },
      },
    },
    pricing: {
      isFree: { type: Boolean, default: true },
      commissionRate: {
        type: Number,
        min: [0, 'Commission rate cannot be negative'],
        max: [1, 'Commission rate cannot exceed 100%'],
      },
      requiredPlanIds: [{ type: Schema.Types.ObjectId, ref: 'Plan' }],
    },
    logoUrl: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || validator.isURL(v, { protocols: ['http', 'https'] }),
        message: 'Invalid URL format for logo',
      },
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    videos: [
      {
        id: { type: String, required: true, default: () => randomUUID() },
        url: {
          type: String,
          required: true,
          trim: true,
          validate: {
            validator: (v: string) => validator.isURL(v, { protocols: ['http', 'https'] }),
            message: 'Invalid URL format for video',
          },
        },
        position: { type: String, enum: ['left', 'center', 'right'], required: true, default: 'center' },
        size: { type: String, enum: ['small', 'medium', 'large'], required: true, default: 'medium' },
        fontSize: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%)$/.test(v),
            message: 'Invalid CSS font-size value',
          },
        },
        fontFamily: { type: String, trim: true },
        margin: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%)(?:\s+\d+(\.\d+)?(?:px|rem|em|%))*$/.test(v),
            message: 'Invalid CSS margin value',
          },
        },
        padding: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%)(?:\s+\d+(\.\d+)?(?:px|rem|em|%))*$/.test(v),
            message: 'Invalid CSS padding value',
          },
        },
        customPosition: {
          position: { type: String, enum: ['absolute', 'relative', 'fixed'] },
          top: {
            type: String,
            trim: true,
            validate: {
              validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%|vh|vw)$/.test(v),
              message: 'Invalid CSS top value',
            },
          },
          left: {
            type: String,
            trim: true,
            validate: {
              validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%|vh|vw)$/.test(v),
              message: 'Invalid CSS left value',
            },
          },
        },
      },
    ],
    images: [
      {
        id: { type: String, required: true, default: () => randomUUID() },
        url: {
          type: String,
          required: true,
          trim: true,
          validate: {
            validator: (v: string) => validator.isURL(v, { protocols: ['http', 'https'] }),
            message: 'Invalid URL format for image',
          },
        },
        position: { type: String, enum: ['left', 'center', 'right'], required: true, default: 'center' },
        size: { type: String, enum: ['small', 'medium', 'large'], required: true, default: 'medium' },
        fontSize: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%)$/.test(v),
            message: 'Invalid CSS font-size value',
          },
        },
        fontFamily: { type: String, trim: true },
        margin: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%)(?:\s+\d+(\.\d+)?(?:px|rem|em|%))*$/.test(v),
            message: 'Invalid CSS margin value',
          },
        },
        padding: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%)(?:\s+\d+(\.\d+)?(?:px|rem|em|%))*$/.test(v),
            message: 'Invalid CSS padding value',
          },
        },
        customPosition: {
          position: { type: String, enum: ['absolute', 'relative', 'fixed'] },
          top: {
            type: String,
            trim: true,
            validate: {
              validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%|vh|vw)$/.test(v),
              message: 'Invalid CSS top value',
            },
          },
          left: {
            type: String,
            trim: true,
            validate: {
              validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%|vh|vw)$/.test(v),
              message: 'Invalid CSS left value',
            },
          },
        },
      },
    ],
    articles: [
      {
        id: { type: String, required: true, default: () => randomUUID() },
        title: {
          type: String,
          required: true,
          trim: true,
          minlength: [2, 'Article title must be at least 2 characters'],
        },
        content: {
          type: String,
          required: true,
          trim: true,
          minlength: [10, 'Article content must be at least 10 characters'],
        },
        backgroundColor: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^#([0-9A-F]{3}){1,2}$/i.test(v) || /^rgb\(\d+,\d+,\d+\)$/.test(v) || /^rgba\(\d+,\d+,\d+,\d*\.?\d+\)$/.test(v),
            message: 'Invalid CSS color value for backgroundColor',
          },
        },
        textColor: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^#([0-9A-F]{3}){1,2}$/i.test(v) || /^rgb\(\d+,\d+,\d+\)$/.test(v) || /^rgba\(\d+,\d+,\d+,\d*\.?\d+\)$/.test(v),
            message: 'Invalid CSS color value for textColor',
          },
        },
        fontSize: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%)$/.test(v),
            message: 'Invalid CSS font-size value',
          },
        },
        fontFamily: { type: String, trim: true },
      },
    ],
    buttons: [
      {
        id: { type: String, required: true, default: () => randomUUID() },
        label: {
          type: String,
          required: true,
          trim: true,
          minlength: [2, 'Button label must be at least 2 characters'],
        },
        link: {
          type: String,
          required: true,
          trim: true,
          validate: {
            validator: (v: string) => validator.isURL(v, { protocols: ['http', 'https'] }),
            message: 'Invalid URL format for button link',
          },
        },
        type: { type: String, enum: ['primary', 'secondary', 'link'], required: true, default: 'primary' },
        backgroundColor: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^#([0-9A-F]{3}){1,2}$/i.test(v) || /^rgb\(\d+,\d+,\d+\)$/.test(v) || /^rgba\(\d+,\d+,\d+,\d*\.?\d+\)$/.test(v),
            message: 'Invalid CSS color value for backgroundColor',
          },
        },
        textColor: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^#([0-9A-F]{3}){1,2}$/i.test(v) || /^rgb\(\d+,\d+,\d+\)$/.test(v) || /^rgba\(\d+,\d+,\d+,\d*\.?\d+\)$/.test(v),
            message: 'Invalid CSS color value for textColor',
          },
        },
        borderRadius: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%)$/.test(v),
            message: 'Invalid CSS border-radius value',
          },
        },
        padding: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || /^\d+(\.\d+)?(?:px|rem|em|%)(?:\s+\d+(\.\d+)?(?:px|rem|em|%))*$/.test(v),
            message: 'Invalid CSS padding value',
          },
        },
      },
    ],
    dividers: [
      {
        id: { type: String, required: true, default: () => randomUUID() },
        style: {
          type: String,
          trim: true,
          default: 'solid 1px gray',
          validate: {
            validator: (v: string) => !v || /^(solid|dashed|dotted)\s+\d+(\.\d+)?px\s+(#[0-9A-F]{3,6}|rgb\(\d+,\d+,\d+\)|rgba\(\d+,\d+,\d+,\d*\.?\d+\))$/.test(v),
            message: 'Invalid CSS border style value',
          },
        },
      },
    ],
    isActive: { type: Boolean, default: true },
    sandbox: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'Created by is required'] },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'Updated by is required'] },
    history: [
      {
        event: { type: String, required: true },
        date: { type: Date, default: Date.now },
      },
    ],
    enabledBySellers: [{ type: Schema.Types.ObjectId, ref: 'Seller', default: [] }],
    connected: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'expired', 'needs_reauth'],
      default: 'disconnected',
    },
    accessToken: {
      type: String,
      set: (value: string) => (value ? encrypt(value) : undefined),
      get: (value: string) => (value ? decrypt(value) : undefined),
    },
  },
  { timestamps: true, toJSON: { getters: true } }
);

integrationSchema.index({ providerName: 1 }, { unique: true });
integrationSchema.index({ type: 1, isActive: 1, sandbox: 1 });

const Integration: Model<IIntegration> =
  mongoose.models.Integration || mongoose.model<IIntegration>('Integration', integrationSchema);

export default Integration;