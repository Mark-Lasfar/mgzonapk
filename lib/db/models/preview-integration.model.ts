import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPreviewIntegration extends Document {
  _id: string;
  providerName: string;
  type: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
  sandbox: boolean;
  // credentials?: Array<{ key: string; value: string }>;
  credentials: {
    type: Object, // أو mongoose.Schema.Types.Mixed
    default: {},
  },
  apiEndpoints: {
    type: Object, // أو mongoose.Schema.Types.Mixed
    default: {},
  },
  webhook?: {
    enabled: boolean;
    url: string;
    secret: string;
    events: string[];
  };
  // apiEndpoints?: Array<{ key: string; value: string }>;
  settings?: {
    supportedCurrencies?: string[];
    supportedCountries?: string[];
    amountMultiplier?: number;
    apiUrl?: string;
    authType?: 'Bearer' | 'Basic' | 'APIKey' | 'OAuth';
    clientId?: string;
    clientSecret?: string;
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
    redirectUri?: string;
    responseMapping?: Record<string, string>;
    retryOptions?: {
      maxRetries: number;
      initialDelay: number;
    };
  };
  pricing?: {
    isFree: boolean;
    commissionRate?: number;
    requiredPlanIds?: string[];
  };
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
  autoRegister?: {
    enabled: boolean;
    fields?: Array<{ key: string; label: string; type: 'text' | 'email' | 'password' | 'number'; required: boolean }>;
  };
  createdBy: string;
  expiresAt: Date;
}

const previewIntegrationSchema = new Schema<IPreviewIntegration>(
  {
    _id: { type: String, required: true },
    providerName: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'payment', 'warehouse', 'dropshipping', 'marketplace', 'shipping', 'marketing', 'accounting',
        'crm', 'analytics', 'automation', 'communication', 'education', 'security', 'advertising', 'tax', 'other',
      ],
      required: true,
    },
    description: { type: String },
    logoUrl: { type: String },
    isActive: { type: Boolean, default: true },
    sandbox: { type: Boolean, default: false },
    credentials: [{ key: String, value: String }],
    webhook: {
      enabled: { type: Boolean, default: false },
      url: { type: String },
      secret: { type: String },
      events: [{ type: String }],
    },
    apiEndpoints: [{ key: String, value: String }],
    settings: {
      supportedCurrencies: [{ type: String }],
      supportedCountries: [{ type: String }],
      amountMultiplier: { type: Number, default: 1 },
      apiUrl: { type: String },
      authType: { type: String, enum: ['Bearer', 'Basic', 'APIKey', 'OAuth'] },
      clientId: { type: String },
      clientSecret: { type: String },
      authorizationUrl: { type: String },
      tokenUrl: { type: String },
      scopes: [{ type: String }],
      redirectUri: { type: String },
      responseMapping: { type: Map, of: String },
      retryOptions: {
        maxRetries: { type: Number, default: 3 },
        initialDelay: { type: Number, default: 1000 },
      },
    },
    pricing: {
      isFree: { type: Boolean, default: true },
      commissionRate: { type: Number },
      requiredPlanIds: [{ type: String }],
    },
    videos: [
      {
        id: { type: String, default: () => crypto.randomUUID() },
        url: { type: String, required: true },
        position: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
        size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
        fontSize: { type: String },
        fontFamily: { type: String },
        margin: { type: String },
        padding: { type: String },
        customPosition: {
          position: { type: String, enum: ['absolute', 'relative', 'fixed'] },
          top: { type: String },
          left: { type: String },
        },
      },
    ],
    images: [
      {
        id: { type: String, default: () => crypto.randomUUID() },
        url: { type: String, required: true },
        position: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
        size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
        fontSize: { type: String },
        fontFamily: { type: String },
        margin: { type: String },
        padding: { type: String },
        customPosition: {
          position: { type: String, enum: ['absolute', 'relative', 'fixed'] },
          top: { type: String },
          left: { type: String },
        },
      },
    ],
    articles: [
      {
        id: { type: String, default: () => crypto.randomUUID() },
        title: { type: String, required: true },
        content: { type: String, required: true },
        backgroundColor: { type: String },
        textColor: { type: String },
        fontSize: { type: String },
        fontFamily: { type: String },
      },
    ],
    buttons: [
      {
        id: { type: String, default: () => crypto.randomUUID() },
        label: { type: String, required: true },
        link: { type: String, required: true },
        type: { type: String, enum: ['primary', 'secondary', 'link'], default: 'primary' },
        backgroundColor: { type: String },
        textColor: { type: String },
        borderRadius: { type: String },
        padding: { type: String },
      },
    ],
    dividers: [
      {
        id: { type: String, default: () => crypto.randomUUID() },
        style: { type: String, default: 'solid 1px gray' },
      },
    ],
    autoRegister: {
      enabled: { type: Boolean, default: false },
      fields: [
        {
          key: { type: String, required: true },
          label: { type: String, required: true },
          type: { type: String, enum: ['text', 'email', 'password', 'number'], default: 'text' },
          required: { type: Boolean, default: true },
        },
      ],
    },
    createdBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

previewIntegrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PreviewIntegration: Model<IPreviewIntegration> =
  mongoose.models.PreviewIntegration || mongoose.model('PreviewIntegration', previewIntegrationSchema);

export default PreviewIntegration;