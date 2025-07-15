import mongoose, { Schema, Document, Model } from 'mongoose';
import validator from 'validator';
import { encrypt, decrypt } from '@/lib/utils/encryption';

export interface SellerIntegration {
  providerName: string;
  type: 'payment' | 'warehouse' | 'dropshipping' | 'marketplace' | 'shipping' | 'marketing' | 'accounting' | 'crm' | 'analytics' | 'automation' | 'communication' | 'education' | 'security' | 'advertising' | 'tax' | 'other';

  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  metadata: Record<string, any>;
  isActive: boolean;
  
  connectedAt: Date;
  lastUpdatedAt: Date;
  sandbox?: boolean;
}

export interface ISeller extends Document {
  userId: string;
  businessName: string;
  email: string;
  phone: string;
  description?: string;
  businessType: 'individual' | 'company';
  vatRegistered: boolean;
  logo?: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    countryCode: string;
  };
  taxId?: string;
  paymentGateways: Array<{
    providerName: string;
    accountDetails: Record<string, any>;
    verified: boolean;
    isDefault: boolean;
    isInternal: boolean; // أضفت هذا للإشارة إلى بوابة mgzon
    sandbox?: boolean;
  }>;
  subscription: {
    plan: string;
    planId: string;
    price: number;
    trialMonthsUsed: number;
    pointsCost: number;
    startDate: Date;
    endDate?: Date;
    lastPaymentDate?: Date;
    status: 'active' | 'inactive' | 'expired' | 'cancelled' | 'pending' | 'suspended';
    isTrial?: boolean;
    trialDuration?: number;
    features: {
      productsLimit: number;
      commission: number;
      prioritySupport: boolean;
      instantPayouts: boolean;
      customSectionsLimit: number;
      domainSupport: boolean;
      domainRenewal: boolean;
      analyticsAccess: boolean;
      abTesting: boolean;
      pointsRedeemable: boolean;
      dynamicPaymentGateways: boolean;
      maxApiKeys: number; // أضفت هذا
    };
    pointsRedeemed?: number;
    paymentMethod?: string;
    paymentGatewayId?: string;
    paymentId?: string;
    activeGatewayConfig?: Record<string, any>;
    metadata?: Record<string, any>;
  };
  bankInfo?: {
    verified: boolean;
    accountName: string; 
    accountNumber: string;
    bankName: string;
    swiftCode: string; 
    routingNumber?: string;
  };
  verification: {
    status: 'pending' | 'verified' | 'rejected';
    documents: Array<{
      url: string;
      type: 'id' | 'business_license' | 'tax_document' | 'other';
      status: 'pending' | 'verified' | 'rejected';
      uploadedAt: Date;
      metadata?: Record<string, any>;
    }>;
    submittedAt: Date;
    lastUpdatedAt?: Date;
  };



  status: 'active' | 'inactive' | 'expired' | 'cancelled' | 'pending' | 'suspended';


  
  integrationIds: mongoose.Types.ObjectId[];
  integrations: Record<string, SellerIntegration>;
  taxSettings: Record<string, {
    countryCode: string;
    taxType: string;
    taxRate: number;
    taxService:string;
  }>;
  defaultCurrency: string;
  checkoutSettings: {
    customCheckoutEnabled: boolean;
    checkoutPageUrl?: string;
  };
  metrics: {
    rating: number;
    totalSales: number;
    totalRevenue: number;
    productsCount: number;
    ordersCount: number;
    customersCount: number;
    views: number;
    followers: number;
    ratingsCount?: number;
    totalSalesHistory: Array<{ amount: number; date: Date }>;
    viewsHistory: Array<{ date: Date }>;
    lastProductCreated?: Date;
    products: {
      total: number;
      active: number;
      outOfStock: number;
    };
    integrationErrors?: Array<{
      providerName: string;
      errorCode: string;
      message: string;
      timestamp: Date;
    }>;
  };
  settings: {
    language: 'en' | 'ar' | 'fr' | 'es' | 'de' | 'other';
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
      
      orderUpdates: boolean;
      marketingEmails: boolean;
      pointsNotifications: boolean;
    };
    display: {
      showRating: boolean;
      showContactInfo: boolean;
      showMetrics: boolean;
      showPointsBalance: boolean;
      welcomeSeen: boolean;
    };
    security: {
      twoFactorAuth: boolean;
      loginNotifications: boolean;
      ipWhitelist?: string[];
    };
    customSite: {
      theme: string;
      primaryColor: string;
      bannerImage?: string;
      customSections?: Array<{
        title: string;
        content: string;
        order: number;
      }>;
      domainStatus?: 'active' | 'expired' | 'pending';
      domainRenewalDate?: Date;
      seo: {
        metaTitle?: string;
        metaDescription?: string;
        keywords?: string[];
      };
    };
    abTesting: {
      enabled: boolean;
      experiments: Array<{
        name: string;
        variant: string;
        startDate: Date;
        endDate?: Date;
        metrics: Record<string, number>;
      }>;
    };
  };
  pointsBalance: number;
  pointsHistory: Array<{
    amount: number;
    type: 'credit' | 'debit';
    reason: string;
    orderId?: string;
    createdAt: Date;
  }>;
  freeTrial: boolean;
  freeTrialEndDate?: Date;
  trialMonthsUsed: number;
  customSiteUrl?: string;
  storeName?: string;
  domain?: string;
  apiKeys: mongoose.Types.ObjectId[];
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  freeTrialActive?: boolean;
  updatedAt: Date;
  addPoints(amount: number, reason: string, orderId?: string): Promise<void>;
  toggleIntegration(providerName: string, isActive: boolean): Promise<void>;
  logIntegrationError(providerName: string, errorCode: string, message: string): Promise<void>;
}

const SellerSchema: Schema<ISeller> = new Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      unique: true,
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => validator.isUUID(v) || mongoose.Types.ObjectId.isValid(v),
        message: 'User ID must be a valid UUID or MongoDB ObjectId',
      },
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      minlength: [2, 'Business name must be at least 2 characters'],
      maxlength: [100, 'Business name cannot exceed 100 characters'],
      index: true,
      validate: {
        validator: (v: string) => /^[\p{L}\p{N}\s.,!?&()-]+$/u.test(v),
        message: 'Business name contains invalid characters',
      },
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (v: string) => validator.isEmail(v),
        message: 'Please enter a valid email address',
      },
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      validate: {
        validator: (v: string) => /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(v),
        message: 'Please enter a valid phone number',
      },
    },
description: {
  type: String,
  trim: true,
  minlength: [10, 'Description must be at least 10 characters if provided'],
  maxlength: [500, 'Description cannot exceed 500 characters'],
  validate: {
    validator: (v: string) => !v || /^[\p{L}\p{N}\s.,!?&()\n-]+$/u.test(v),
    message: 'Description contains invalid characters',
  },
},
    businessType: {
      type: String,
      enum: ['individual', 'company'],
      required: [true, 'Business type is required'],
    },
    vatRegistered: {
      type: Boolean,
      default: false,
    },
logo: {
  type: String,
  trim: true,
  validate: {
    validator: (v: string) =>
      !v ||
      (validator.isURL(v, { protocols: ['http', 'https'], require_protocol: true }) &&
        /\.(png|jpg|jpeg|webp|svg)$/i.test(v)),
    message: 'Please provide a valid image URL (png, jpg, jpeg, webp, svg)',
  },
  default: null,
},
address: {
  street: { type: String, required: [true, 'Street is required'], trim: true },
  city: { type: String, required: [true, 'City is required'], trim: true },
  state: { type: String, required: [true, 'State is required'], trim: true },
  countryCode: { type: String, required: [true, 'Country code is required'], match: /^[A-Z]{2}$/ },
  postalCode: {
    type: String,
    required: [true, 'Postal code is required'],
    trim: true,
    validate: {
      validator: (v: string) => /^[0-9A-Z\s-]*$/.test(v),
      message: 'Please enter a valid postal code',
    },
  },
  _id: false,
},
    taxId: {
      type: String,
      trim: true,
      minlength: [5, 'Tax ID must be at least 5 characters if provided'],
      validate: {
        validator: (v: string) => !v || validator.isAlphanumeric(v.replace(/[-]/g, '')),
        message: 'Tax ID contains invalid characters',
      },
    },
    paymentGateways: [
      {
        providerName: { type: String, required: true },
        accountDetails: {
          type: Map,
          of: {
            type: String,
            set: (val: string) => (val ? encrypt(val) : undefined),
            get: (val: string) => (val ? decrypt(val) : undefined),
          },
          default: {},
        },
        verified: { type: Boolean, default: false },
        isDefault: { type: Boolean, default: false },
        isInternal: { type: Boolean, default: false },
        sandbox: { type: Boolean, default: false },
        config: {
          // إعدادات إضافية للبوابة
          apiType: { type: String, enum: ['rest', 'sdk', 'other'], default: 'rest' },
          endpoints: {
            createOrder: { type: String, trim: true }, // نقطة طرفية لإنشاء الطلب
            capturePayment: { type: String, trim: true }, // نقطة طرفية لتأكيد الدفع
            auth: { type: String, trim: true }, // نقطة طرفية للمصادقة
          },
          sdkUrl: { type: String, trim: true }, // لدعم بوابات تستخدم SDK (مثل Stripe)
          _id: false,
        },
        _id: false,
      },
    ],
    subscription: {
      plan: {
        type: String,
        required: [true, 'Subscription plan is required'],
        default: 'trial',
      },
      planId: {
        type: String,
        required: [true, 'Plan ID is required'],
      },
      price: {
        type: Number,
        required: [true, 'Subscription price is required'],
        default: 1,
        min: 0,
      },
      pointsCost: {
        type: Number,
        required: [true, 'Points cost is required'],
        default: 20,
        min: 0,
      },
      startDate: {
        type: Date,
        required: [true, 'Subscription start date is required'],
        default: Date.now,
      },
      endDate: { type: Date },
      lastPaymentDate: { type: Date },
      status: {
        type: String,
        enum: ['active', 'inactive', 'expired', 'cancelled', 'pending', 'suspended'],
        default: 'pending',
      },
      isTrial: { type: Boolean, default: false },
      trialDuration: { type: Number, min: 0 },
      features: {
        productsLimit: { type: Number, default: 10, min: 0 },
        commission: { type: Number, default: 10, min: 0 },
        prioritySupport: { type: Boolean, default: false },
        instantPayouts: { type: Boolean, default: false },
        customSectionsLimit: { type: Number, default: 0, min: 0 },
        domainSupport: { type: Boolean, default: false },
        domainRenewal: { type: Boolean, default: false },
        analyticsAccess: { type: Boolean, default: false },
        abTesting: { type: Boolean, default: false },
        pointsRedeemable: { type: Boolean, default: false },
        dynamicPaymentGateways: { type: Boolean, default: false },
        maxApiKeys: { type: Number, default: 1, min: 0 }, 
        _id: false,
      },
      pointsRedeemed: { type: Number, default: 0, min: 0 },
      paymentMethod: { type: String },
      paymentGatewayId: { type: String, trim: true },
      paymentId: { type: String, trim: true },
      activeGatewayConfig: { type: Map, of: Schema.Types.Mixed },
      metadata: { type: Map, of: Schema.Types.Mixed },
      _id: false,
    },
    bankInfo: {
      verified: { type: Boolean, default: false },
      accountName: { type: String }, 
      accountNumber: {
        type: String,
        set: (value: string) => (value ? encrypt(value) : undefined),
        get: (value: string) => (value ? decrypt(value) : undefined),
      },
      bankName: { type: String },
      swiftCode: { type: String }, 
      routingNumber: {
        type: String,
        set: (value: string) => (value ? encrypt(value) : undefined),
        get: (value: string) => (value ? decrypt(value) : undefined),
      },
      _id: false,
    },
    verification: {
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
      },
      documents: [
        {
          url: {
            type: String,
            trim: true,
            validate: {
              validator: (v: string) => validator.isURL(v, { protocols: ['http', 'https'] }),
              message: 'Document URL must be valid',
            },
          },
          type: {
            type: String,
            enum: ['id', 'business_license', 'tax_document', 'other'],
            required: true,
          },
          status: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending',
          },
          uploadedAt: { type: Date, default: Date.now },
          metadata: { type: Schema.Types.Mixed },
          _id: false,
        },
      ],
      submittedAt: {
        type: Date,
        required: [true, 'Verification submission date is required'],
        default: Date.now,
      },
      lastUpdatedAt: { type: Date },
      _id: false,
    },
    integrationIds: [{ type: Schema.Types.ObjectId, ref: 'Integration', default: [] }],
integrations: {
  type: Map,
  of: {
    providerName: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'payment', 'warehouse', 'dropshipping', 'marketplace', 'shipping', 'marketing', 'accounting',
        'crm', 'analytics', 'automation', 'communication', 'education', 'security', 'advertising', 'tax', 'other',
      ],
      required: true,
    },
    accessToken: {
      type: String,
      set: (val: string) => (val ? encrypt(val) : undefined),
      get: (val: string) => (val ? decrypt(val) : undefined),
    },
    refreshToken: {
      type: String,
      set: (val: string) => (val ? encrypt(val) : undefined),
      get: (val: string) => (val ? decrypt(val) : undefined),
    },
    expiresAt: { type: Date },
    metadata: { type: Schema.Types.Mixed, default: {} },
    isActive: { type: Boolean, default: true },
    connectedAt: { type: Date, default: Date.now },
    lastUpdatedAt: { type: Date, default: Date.now },
    sandbox: { type: Boolean, default: false },
    apiEndpoints: {
      type: Map,
      of: String,
      default: {},
    },
    _id: false,
  },
  default: {},
},
    taxSettings: {
      type: Map,
      of: {
        countryCode: { type: String, required: true, match: /^[A-Z]{2}$/ },
        taxType: {
          type: String,
          default: 'none',
        },
        taxRate: { type: Number, default: 0, min: 0 },
        taxService: {
          type: String,  
          default: 'none',
        },
        _id: false,
      },
      default: {},
    },
    defaultCurrency: {
      type: String,
      default: 'USD',
      validate: {
        validator: (v: string) => /^[A-Z]{3}$/.test(v),
        message: 'Invalid currency code',
      },
    },
    checkoutSettings: {
      customCheckoutEnabled: { type: Boolean, default: false },
      checkoutPageUrl: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
          message: 'Invalid checkout page URL',
        },
      },
      _id: false,
    },
    metrics: {
      rating: { type: Number, default: 0, min: 0, max: 5 },
      totalSales: { type: Number, default: 0, min: 0 },
      totalRevenue: { type: Number, default: 0, min: 0 },
      productsCount: { type: Number, default: 0, min: 0 },
      ordersCount: { type: Number, default: 0, min: 0 },
      customersCount: { type: Number, default: 0, min: 0 },
      views: { type: Number, default: 0, min: 0 },
      followers: { type: Number, default: 0, min: 0 },
      ratingsCount: { type: Number, default: 0, min: 0 },
      totalSalesHistory: [
        {
          amount: { type: Number, required: true, min: 0 },
          date: { type: Date, required: true },
          _id: false,
        },
        { default: [] },
      ],
      viewsHistory: [
        { date: { type: Date, required: true }, _id: false },
        { default: [] },
      ],
      lastProductCreated: { type: Date },
      products: {
        total: { type: Number, default: 0, min: 0 },
        active: { type: Number, default: 0, min: 0 },
        outOfStock: { type: Number, default: 0, min: 0 },
        _id: false,
      },
      integrationErrors: [
        {
          providerName: { type: String, required: true },
          errorCode: { type: String, required: true },
          message: { type: String, required: true },
          timestamp: { type: Date, default: Date.now },
          _id: false,
        },
        { default: [] },
      ],
      _id: false,
    },
    settings: {
      language: { type: String, enum: ['en', 'ar', 'fr', 'es', 'de', 'other'], default: 'en' },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: false },
        orderUpdates: { type: Boolean, default: true },
        marketingEmails: { type: Boolean, default: false },
        pointsNotifications: { type: Boolean, default: true },
        _id: false,
      },
      display: {
        showRating: { type: Boolean, default: true },
        showContactInfo: { type: Boolean, default: true },
        showMetrics: { type: Boolean, default: true },
        showPointsBalance: { type: Boolean, default: true },
        welcomeSeen: { type: Boolean, default: false },
        _id: false,
      },
      security: {
        twoFactorAuth: { type: Boolean, default: false },
        loginNotifications: { type: Boolean, default: true },
        ipWhitelist: [{ type: String, validate: validator.isIP }],
        _id: false,
      },
      customSite: {
        theme: { type: String, default: 'default', trim: true },
        primaryColor: {
          type: String,
          default: '#000000',
          validate: {
            validator: (v: string) => /^#[0-9A-F]{6}$/i.test(v),
            message: 'Please enter a valid hex color code',
          },
          trim: true,
        },
        bannerImage: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) =>
              !v || validator.isURL(v, { protocols: ['http', 'https'] }),
            message: 'Banner image URL must be valid',
          },
        },
        customSections: [
          {
            title: {
              type: String,
              required: true,
              trim: true,
              minlength: [2, 'Section title must be at least 2 characters'],
            },
            content: {
              type: String,
              required: true,
              trim: true,
              minlength: [10, 'Section content must be at least 10 characters'],
            },
            order: { type: Number, default: 0 },
            _id: false,
          },
        ],
        domainStatus: {
          type: String,
          enum: ['active', 'expired', 'pending'],
          default: 'pending',
        },
        domainRenewalDate: { type: Date },
        seo: {
          metaTitle: { type: String, trim: true, maxlength: 60 },
          metaDescription: { type: String, trim: true, maxlength: 160 },
          keywords: [{ type: String, trim: true }],
          _id: false,
        },
        _id: false,
      },
      abTesting: {
        enabled: { type: Boolean, default: false },
        experiments: [
          {
            name: { type: String, required: true },
            variant: { type: String, required: true },
            startDate: { type: Date, required: true },
            endDate: { type: Date },
            metrics: { type: Schema.Types.Mixed, default: {} },
            _id: false,
          },
        ],
        _id: false,
      },
      _id: false,
    },
    pointsBalance: {
      type: Number,
      default: 50,
      min: [0, 'Points balance cannot be negative'],
    },
    pointsHistory: [
      {
        amount: {
          type: Number,
          required: true,
          min: 0,
        },
        type: {
          type: String,
          enum: ['credit', 'debit'],
          required: true,
        },
        reason: {
          type: String,
          required: true,
          trim: true,
          minlength: [2, 'Reason must be at least 2 characters'],
        },
        orderId: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || mongoose.Types.ObjectId.isValid(v),
            message: 'Invalid order ID',
          },
        },
        createdAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    freeTrial: {
      type: Boolean,
      default: false,
    },
    freeTrialEndDate: { type: Date },
    trialMonthsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    customSiteUrl: {
      type: String,
      required: [true, 'Custom site URL is required'],
      trim: true,
      lowercase: true,
      validate: {
        validator: (v: string) => /^[a-z0-9_-]+$/.test(v),
        message: 'Custom site URL must contain only lowercase letters, numbers, underscores, or hyphens',
      },
    },
    storeName: { type: String, trim: true },
    domain: {
      type: String,
      trim: true,
      validate: {
        validator: (v: string) => !v || validator.isFQDN(v),
        message: 'Invalid domain name',
      },
    },
    apiKeys: [{ type: Schema.Types.ObjectId, ref: 'ApiKey', default: [] }],
    isActive: { type: Boolean, default: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { getters: true } }
);

// Encrypt sensitive data before saving
SellerSchema.pre('save', function (next) {
  if (this.isModified('integrations')) {
    for (const key in this.integrations) {
      const integration = this.integrations[key];
      if (integration.accessToken) {
        integration.accessToken = encrypt(integration.accessToken);
      }
      if (integration.refreshToken) {
        integration.refreshToken = encrypt(integration.refreshToken);
      }
    }
  }
  if (this.isModified('paymentGateways')) {
    this.paymentGateways.forEach((gateway: any) => {
      if (gateway.accountDetails) {
        gateway.accountDetails = encrypt(JSON.stringify(gateway.accountDetails));
      }
    });
  }
  if (this.isModified('bankInfo')) {
    if (this.bankInfo?.accountNumber) {
      this.bankInfo.accountNumber = encrypt(this.bankInfo.accountNumber);
    }
    if (this.bankInfo?.swiftCode) {
      this.bankInfo.swiftCode = encrypt(this.bankInfo.swiftCode);
    }
    if (this.bankInfo?.routingNumber) {
      this.bankInfo.routingNumber = encrypt(this.bankInfo.routingNumber);
    }
  }
  next();
});

// Decrypt sensitive data when retrieving
SellerSchema.post(['find', 'findOne'], function (docs) {
  if (!Array.isArray(docs)) {
    docs = [docs];
  }
  docs.forEach((doc: any) => {
    if (!doc) return;
    for (const key in doc.integrations) {
      const integration = doc.integrations[key];
      if (integration.accessToken) {
        integration.accessToken = decrypt(integration.accessToken);
      }
      if (integration.refreshToken) {
        integration.refreshToken = decrypt(integration.refreshToken);
      }
    }
    doc.paymentGateways.forEach((gateway: any) => {
      if (gateway.accountDetails) {
        gateway.accountDetails = JSON.parse(decrypt(gateway.accountDetails));
      }
    });
    if (doc.bankInfo?.accountNumber) {
      doc.bankInfo.accountNumber = decrypt(doc.bankInfo.accountNumber);
    }
    if (doc.bankInfo?.swiftCode) {
      doc.bankInfo.swiftCode = decrypt(doc.bankInfo.swiftCode);
    }
    if (doc.bankInfo?.routingNumber) {
      doc.bankInfo.routingNumber = decrypt(doc.bankInfo.routingNumber);
    }
  });
});

// Methods
SellerSchema.methods.addPoints = async function (amount: number, reason: string, orderId?: string) {
  this.pointsBalance += amount;
  this.pointsHistory.push({
    amount: Math.abs(amount),
    type: amount >= 0 ? 'credit' : 'debit',
    reason,
    orderId,
    createdAt: new Date(),
  });
  await this.save();
};

SellerSchema.methods.toggleIntegration = async function (providerName: string, isActive: boolean) {
  if (this.integrations[providerName]) {
    this.integrations[providerName].isActive = isActive;
    this.integrations[providerName].lastUpdatedAt = new Date();
    await this.save();
  } else {
    throw new Error(`Integration ${providerName} not found`);
  }
};

SellerSchema.methods.logIntegrationError = async function (
  providerName: string,
  errorCode: string,
  message: string
) {
  this.metrics.integrationErrors = this.metrics.integrationErrors || [];
  this.metrics.integrationErrors.push({
    providerName,
    errorCode,
    message,
    timestamp: new Date(),
  });
  await this.save();
};

// Indexes for performance
SellerSchema.index({ userId: 1, email: 1, customSiteUrl: 1 }, { unique: true });
SellerSchema.index({ 'metrics.totalSales': 1 });
SellerSchema.index({ 'integrations.providerName': 1 });
SellerSchema.index({ 'settings.language': 1 });
SellerSchema.index({ 'taxSettings.countryCode': 1 });

if (mongoose.models.Seller) {
  delete mongoose.models.Seller;
}
const Seller: Model<ISeller> = mongoose.model<ISeller>('Seller', SellerSchema);
export default Seller;