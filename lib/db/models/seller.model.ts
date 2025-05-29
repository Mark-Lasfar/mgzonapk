import mongoose, { Schema, Types, Document, Model } from 'mongoose';
import crypto from 'crypto';

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
    country: string;
    postalCode: string;
  };
  taxId: string;
  bankInfo: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    swiftCode: string;
    verified: boolean;
  };
  subscription: {
    plan: 'Trial' | 'Basic' | 'Pro' | 'VIP';
    startDate: Date;
    endDate: Date;
    status: 'active' | 'expired' | 'cancelled' | 'pending' | 'suspended';
    features: {
      productsLimit: number;
      commission: number;
      prioritySupport: boolean;
      instantPayouts: boolean;
      customSectionsLimit?: number;
    };
    pointsRedeemed?: number;
    paymentMethod?: 'stripe' | 'paypal';
    paymentId?: string;
  };
  verification: {
    status: 'pending' | 'verified' | 'rejected';
    documents: Record<
      string,
      {
        url: string;
        status: 'pending' | 'verified' | 'rejected';
        uploadedAt: Date;
        metadata?: Record<string, any>;
      }
    >;
    submittedAt: Date;
    lastUpdatedAt?: Date;
  };
  stripeAccountId?: string;
  preferredWarehouse?: {
    provider: 'ShipBob' | '4PX';
    warehouseId: string;
    selectedAt: Date;
    reason?: string;
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
    totalSalesHistory?: { amount: number; date: Date }[];
    viewsHistory?: { date: Date }[];
    lastProductCreated?: Date;
    products: {
      total: number;
      active: number;
      outOfStock: number;
    };
  };
  settings: {
    notifications: {
      email: boolean;
      sms: boolean;
      orderUpdates: boolean;
      marketingEmails: boolean;
      pointsNotifications: boolean;
    };
    display: {
      showRating: boolean;
      showContactInfo: boolean;
      showMetrics: boolean;
      showPointsBalance: boolean;
    };
    security: {
      twoFactorAuth: boolean;
      loginNotifications: boolean;
    };
    customSite: {
      theme: string;
      primaryColor: string;
      bannerImage?: string;
      customSections?: Array<{
        title: string;
        content: string;
      }>;
    };
  };
  pointsBalance: number;
  pointsTransactions: Array<{
    amount: number;
    type: 'earn' | 'spend' | 'redeem';
    description: string;
    orderId?: string;
    createdAt: Date;
  }>;
  freeTrialActive: boolean;
  freeTrialEndDate?: Date;
  trialMonthsUsed: number;
  customSiteUrl: string;
  apiKeys?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  addPoints(amount: number, description: string, orderId?: string): Promise<void>;
}

const SellerSchema: Schema<ISeller> = new Schema(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true,
      minlength: [2, 'Business name must be at least 2 characters'],
      maxlength: [100, 'Business name cannot exceed 100 characters'],
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
        'Please enter a valid email address',
      ],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [
        /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/,
        'Please enter a valid phone number',
      ],
    },
    description: {
      type: String,
      trim: true,
      minlength: [10, 'Description must be at least 10 characters if provided'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    businessType: {
      type: String,
      enum: {
        values: ['individual', 'company'],
        message: '{VALUE} is not a valid business type',
      },
      required: [true, 'Business type is required'],
    },
    vatRegistered: {
      type: Boolean,
      default: false,
    },
    logo: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.*\.(?:png|jpg|jpeg|webp|svg)$/, 'Please provide a valid image URL'],
    },
    address: {
      street: { type: String, required: [true, 'Street is required'], trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      state: { type: String, required: [true, 'State is required'], trim: true },
      country: { type: String, required: [true, 'Country is required'], trim: true },
      postalCode: {
        type: String,
        required: [true, 'Postal code is required'],
        trim: true,
        match: [/^[0-9A-Z\s-]*$/, 'Please enter a valid postal code'],
      },
    },
    taxId: {
      type: String,
      required: [true, 'Tax ID is required'],
      trim: true,
      minlength: [5, 'Tax ID must be at least 5 characters'],
    },
    bankInfo: {
      accountName: {
        type: String,
        required: [true, 'Account name is required'],
        trim: true,
        minlength: [2, 'Account name must be at least 2 characters'],
        maxlength: [100, 'Account name cannot exceed 100 characters'],
      },
      accountNumber: {
        type: String,
        required: [true, 'Account number is required'],
        trim: true,
        minlength: [8, 'Account number must be at least 8 characters'],
        maxlength: [34, 'Account number cannot exceed 34 characters'],
        match: [/^[0-9A-Za-z]*$/, 'Please enter a valid account number'],
      },
      bankName: {
        type: String,
        required: [true, 'Bank name is required'],
        trim: true,
        minlength: [2, 'Bank name must be at least 2 characters'],
        maxlength: [100, 'Bank name cannot exceed 100 characters'],
      },
      swiftCode: {
        type: String,
        required: [true, 'SWIFT code is required'],
        trim: true,
        match: [
          /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/,
          'Please enter a valid SWIFT code',
        ],
      },
      verified: {
        type: Boolean,
        default: false,
      },
    },
    subscription: {
      plan: {
        type: String,
        enum: {
          values: ['Trial', 'Basic', 'Pro', 'VIP'],
          message: '{VALUE} is not a valid subscription plan',
        },
        required: [true, 'Subscription plan is required'],
      },
      startDate: {
        type: Date,
        required: [true, 'Subscription start date is required'],
      },
      endDate: {
        type: Date,
        required: [true, 'Subscription end date is required'],
      },
      status: {
        type: String,
        enum: {
          values: ['active', 'expired', 'cancelled', 'pending', 'suspended'],
          message: '{VALUE} is not a valid subscription status',
        },
        default: 'pending',
      },
      features: {
        productsLimit: {
          type: Number,
          required: true,
          min: [0, 'Products limit cannot be negative'],
        },
        commission: {
          type: Number,
          required: true,
          min: [0, 'Commission cannot be negative'],
        },
        prioritySupport: { type: Boolean, default: false },
        instantPayouts: { type: Boolean, default: false },
        customSectionsLimit: { type: Number, default: 0 },
      },
      pointsRedeemed: {
        type: Number,
        default: 0,
        min: [0, 'Points redeemed cannot be negative'],
      },
      paymentMethod: {
        type: String,
        enum: {
          values: ['stripe', 'paypal'],
          message: '{VALUE} is not a valid payment method',
        },
      },
      paymentId: { type: String, trim: true },
    },
    verification: {
      status: {
        type: String,
        enum: {
          values: ['pending', 'verified', 'rejected'],
          message: '{VALUE} is not a valid verification status',
        },
        default: 'pending',
      },
      documents: {
        type: Schema.Types.Mixed,
        default: {},
      },
      submittedAt: {
        type: Date,
        required: [true, 'Verification submission date is required'],
      },
      lastUpdatedAt: { type: Date },
    },
    stripeAccountId: {
      type: String,
      trim: true,
    },
    preferredWarehouse: {
      provider: {
        type: String,
        enum: {
          values: ['ShipBob', '4PX'],
          message: '{VALUE} is not a valid warehouse provider',
        },
        required: [true, 'Warehouse provider is required'],
      },
      warehouseId: {
        type: String,
        required: [true, 'Warehouse ID is required'],
      },
      selectedAt: {
        type: Date,
        required: [true, 'Selection date is required'],
      },
      reason: {
        type: String,
        trim: true,
      },
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
      lastProductCreated: { type: Date },
      products: {
        total: { type: Number, default: 0, min: 0 },
        active: { type: Number, default: 0, min: 0 },
        outOfStock: { type: Number, default: 0, min: 0 },
      },
    },
    settings: {
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        orderUpdates: { type: Boolean, default: true },
        marketingEmails: { type: Boolean, default: false },
        pointsNotifications: { type: Boolean, default: true },
      },
      display: {
        showRating: { type: Boolean, default: true },
        showContactInfo: { type: Boolean, default: true },
        showMetrics: { type: Boolean, default: true },
        showPointsBalance: { type: Boolean, default: true },
      },
      security: {
        twoFactorAuth: { type: Boolean, default: false },
        loginNotifications: { type: Boolean, default: true },
      },
      customSite: {
        theme: { type: String, default: 'default', trim: true },
        primaryColor: {
          type: String,
          default: '#000000',
          match: [/^#[0-9A-F]{6}$/i, 'Please enter a valid hex color code'],
          trim: true,
        },
        bannerImage: { type: String, trim: true },
        customSections: [
          {
            title: { type: String, required: true, trim: true },
            content: { type: String, required: true, trim: true },
            _id: false,
          },
        ],
      },
    },
    pointsBalance: {
      type: Number,
      default: 100,
      min: [0, 'Points balance cannot be negative'],
    },
    pointsTransactions: [
      {
        amount: {
          type: Number,
          required: true,
          min: [0, 'Transaction amount cannot be negative'],
        },
        type: {
          type: String,
          enum: {
            values: ['earn', 'spend', 'redeem'],
            message: '{VALUE} is not a valid transaction type',
          },
          required: true,
        },
        description: { type: String, required: true, trim: true },
        orderId: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    freeTrialActive: {
      type: Boolean,
      default: false,
    },
    freeTrialEndDate: {
      type: Date,
    },
    trialMonthsUsed: {
      type: Number,
      default: 0,
      min: [0, 'Trial months used cannot be negative'],
    },
    customSiteUrl: {
      type: String,
      required: [true, 'Custom site URL is required'],
      trim: true,
      unique: true,
    },
    apiKeys: [{ type: Schema.Types.ObjectId, ref: 'ApiKey', default: [] }],
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
    toJSON: {
      transform: (doc, ret) => {
        delete ret.bankInfo?.accountNumber;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// تشفير رقم الحساب قبل الحفظ
SellerSchema.pre('save', async function (next) {
  if (this.isModified('bankInfo.accountNumber') && this.bankInfo.accountNumber) {
    try {
      const secretKey = process.env.ENCRYPTION_KEY || 'my-secret-key-32-characters-long!';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
      let encrypted = cipher.update(this.bankInfo.accountNumber, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      this.bankInfo.accountNumber = `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption error:', error);
      return next(new Error('Failed to encrypt account number'));
    }
  }
  next();
});

// فك تشفير رقم الحساب بعد الاستعلام
async function decryptAccountNumber(doc: ISeller | Record<string, any>) {
  if (!doc?.bankInfo?.accountNumber) return;

  // تحقق من وجود الحقل بدل isSelected
  if (
    doc.bankInfo?.accountNumber &&
    typeof doc.bankInfo.accountNumber === 'string' &&
    doc.bankInfo.accountNumber.includes(':')
  ) {
    try {
      const secretKey = process.env.ENCRYPTION_KEY || 'my-secret-key-32-characters-long!';
      const [ivHex, encrypted] = doc.bankInfo.accountNumber.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secretKey), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      doc.bankInfo.accountNumber = decrypted;
    } catch (error: unknown) {
      console.warn(`Failed to decrypt account number for seller ${doc._id}:`, (error as Error).message);
      doc.bankInfo.accountNumber = '';
      doc.bankInfo.verified = false;
    }
  }
}

SellerSchema.post('find', async function (docs: ISeller[]) {
  if (!docs) return;
  for (const doc of docs) {
    await decryptAccountNumber(doc);
  }
});

SellerSchema.post('findOne', async function (doc: ISeller | null) {
  if (!doc) return;
  await decryptAccountNumber(doc);
});

// إضافة نقاط
SellerSchema.methods.addPoints = async function (
  amount: number,
  description: string,
  orderId?: string
): Promise<void> {
  if (amount <= 0) {
    throw new Error('Points amount must be positive');
  }
  if (!description || description.trim() === '') {
    throw new Error('Transaction description is required');
  }
  if (orderId && !mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error('Invalid order ID');
  }

  this.pointsBalance += amount;
  this.pointsTransactions.push({
    amount,
    type: 'earn',
    description,
    orderId,
    createdAt: new Date(),
  });

  await this.save();
};

// إنشاء فهارس
SellerSchema.index({ email: 1 });
SellerSchema.index({ 'metrics.totalSales': 1 });
SellerSchema.index({ customSiteUrl: 1 });

const Seller: Model<ISeller> =
  mongoose.models.Seller || mongoose.model<ISeller>('Seller', SellerSchema);

export default Seller;