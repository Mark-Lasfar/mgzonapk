import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import validator from 'validator';
import { PaymentMethod, FulfillmentTracking } from '@/lib/api/types';

export interface IOrder extends Document {
  userId?: Types.ObjectId | string;
  sellerId: Types.ObjectId | string;
  items: Array<{
    productId: Types.ObjectId | string;
    name: string;
    slug?: string;
    image?: string;
    price: number;
    quantity: number;
    color?: string;
    size?: string;
    relatedProducts?: string[];
    currency: string;
    taxAmount?: number;
    warehouseId?: Types.ObjectId | string;
    sku: string;
    source?: 'mgzon' | 'external';
    externalId?: string;
  }>;
  deliveredAt :Date;
  isDelivered :boolean;
  itemsPrice: number;
  shippingPrice:number;
  expectedDeliveryDate:Date;
  isPaid:boolean;
  paidAt:Date;
  taxPrice: number;
  totalPrice: number;
  taxAmount: number;
  _id:string;
  shippingAmount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'successful' | 'failed' | 'refunded';
  paymentGatewayId?: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'abandoned' | 'completed';
  fulfillmentStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'failed' | 'fulfilled';
  trackingInfo?: FulfillmentTracking;
  shippingAddress: {
    street: string;
    city: string;
    province:string;
    fullName:string;
    state?: string;
    country: string;
    countryCode: string;
    postalCode: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state?: string;
    country: string;
    countryCode: string;
    postalCode: string;
  };
  
  customerId: {
    name: string;
    email: string;
    phone?: string;
  };
  commission: {
    platformFee: number;
    percentage: number;
    fixed: number;
  };
  escrowStatus: 'held' | 'released' | 'refunded';
  escrowDetails: {
    chargeId?: string;
    releaseDate?: Date;
    refundDate?: Date;
  };
  taxDetails: {
    taxType: 'VAT' | 'GST' | 'SalesTax' | 'none';
    taxRate: number;
    taxBreakdown: Array<{ countryCode: string; taxType: string; rate: number; amount: number }>;
    taxService: string;
    transactionId?: string;
  };
  integrations: Array<{
    providerId: Types.ObjectId | string;
    type: 'payment' | 'warehouse' | 'dropshipping' | 'marketplace' | 'shipping' | 'marketing' | 'accounting' | 'crm' | 'analytics' | 'automation' | 'communication' | 'education' | 'security' | 'advertising' | 'tax' | 'other';
    providerName: string;
    externalOrderId?: string;
    status?: string;
    metadata?: Record<string, any>;
  }>;
  webhookTriggered: boolean;
  notes?: string;
  customFields: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  externalOrderId?: string;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.Mixed,
      ref: 'User',
      index: true,
      trim: true,
    },
    sellerId: {
      type: Schema.Types.Mixed,
      ref: 'Seller',
      required: [true, 'Seller ID is required'],
      index: true,
      trim: true,
    },
    items: [
      {
        productId: {
          type: Schema.Types.Mixed,
          ref: 'Product',
          required: [true, 'Product ID is required'],
          trim: true,
        },
        name: {
          type: String,
          required: [true, 'Item name is required'],
          trim: true,
        },
        slug: { type: String, trim: true },
        image: {
          type: String,
          trim: true,
          validate: {
            validator: (v: string) => !v || validator.isURL(v, { protocols: ['http', 'https'], require_protocol: true }),
            message: 'Invalid image URL',
          },
        },
        price: {
          type: Number,
          required: [true, 'Item price is required'],
          min: [0, 'Price cannot be negative'],
        },
        quantity: {
          type: Number,
          required: [true, 'Item quantity is required'],
          min: [1, 'Quantity must be at least 1'],
        },
        color: { type: String, trim: true },
        size: { type: String, trim: true },
        relatedProducts: [{ type: String, trim: true }],
        currency: {
          type: String,
          required: [true, 'Currency is required'],
          match: [/^[A-Z]{3}$/, 'Invalid currency code'],
        },
        taxAmount: {
          type: Number,
          min: [0, 'Tax amount cannot be negative'],
        },
        warehouseId: {
          type: Schema.Types.Mixed,
          ref: 'Warehouse',
          trim: true,
        },
        sku: {
          type: String,
          required: [true, 'SKU is required'],
          trim: true,
        },
        source: {
          type: String,
          enum: ['mgzon', 'external'],
          default: 'mgzon',
        },
        externalId: { type: String, trim: true },
        _id: false,
      },
    ],
    itemsPrice: {
      type: Number,
      required: [true, 'Items price is required'],
      min: [0, 'Items price cannot be negative'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    taxAmount: {
      type: Number,
      required: [true, 'Tax amount is required'],
      min: [0, 'Tax amount cannot be negative'],
    },
    shippingAmount: {
      type: Number,
      required: [true, 'Shipping amount is required'],
      min: [0, 'Shipping amount cannot be negative'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      match: [/^[A-Z]{3}$/, 'Invalid currency code'],
    },
    paymentMethod: {
      type: String,
      required: [true, 'Payment method is required'],
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'successful', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentGatewayId: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'abandoned', 'completed'],
      default: 'pending',
    },
    fulfillmentStatus: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'failed', 'fulfilled'],
      default: 'pending',
    },
    trackingInfo: {
      carrier: { type: String, trim: true, default: '' },
      trackingNumber: { type: String, trim: true },
      trackingUrl: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || validator.isURL(v, { protocols: ['https'] }),
          message: 'Invalid tracking URL',
        },
      },
      estimatedDeliveryDate: { type: String, trim: true },
      status: { type: String, trim: true },
      statusDetails: { type: String, trim: true },
      lastUpdated: { type: String, trim: true },
      _id: false,
    },
    shippingAddress: {
      street: { type: String, required: [true, 'Street is required'], trim: true },
      city: { type: String, required: [true, 'City is required'], trim: true },
      state: { type: String, trim: true },
      country: { type: String, required: [true, 'Country is required'], trim: true },
      countryCode: {
        type: String,
        required: [true, 'Country code is required'],
        match: [/^[A-Z]{2}$/, 'Invalid country code'],
        trim: true,
      },
      postalCode: {
        type: String,
        required: [true, 'Postal code is required'],
        trim: true,
        validate: {
          validator: (v: string) => /^[0-9A-Z\s-]+$/.test(v),
          message: 'Invalid postal code',
        },
      },
      _id: false,
    },
    billingAddress: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      countryCode: {
        type: String,
        match: [/^[A-Z]{2}$/, 'Invalid country code'],
        trim: true,
      },
      postalCode: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || /^[0-9A-Z\s-]+$/.test(v),
          message: 'Invalid postal code',
        },
      },
      _id: false,
    },
    customerId: {
      name: { type: String, required: [true, 'Customer name is required'], trim: true },
      email: {
        type: String,
        required: [true, 'Customer email is required'],
        trim: true,
        lowercase: true,
        validate: {
          validator: (v: string) => validator.isEmail(v),
          message: 'Invalid email address',
        },
      },
      phone: {
        type: String,
        trim: true,
        validate: {
          validator: (v: string) => !v || /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(v),
          message: 'Invalid phone number',
        },
      },
      _id: false,
    },
    commission: {
      platformFee: { type: Number, required: true, min: 0 },
      percentage: { type: Number, required: true, min: 0 },
      fixed: { type: Number, required: true, min: 0 },
      _id: false,
    },
    escrowStatus: {
      type: String,
      enum: ['held', 'released', 'refunded'],
      default: 'held',
    },
    escrowDetails: {
      chargeId: { type: String, trim: true },
      releaseDate: { type: Date },
      refundDate: { type: Date },
      _id: false,
    },
    taxDetails: {
      taxType: {
        type: String,
        enum: ['VAT', 'GST', 'SalesTax', 'none'],
        default: 'none',
      },
      taxRate: { type: Number, default: 0, min: [0, 'Tax rate cannot be negative'] },
      taxBreakdown: [
        {
          countryCode: {
            type: String,
            required: true,
            match: [/^[A-Z]{2}$/, 'Invalid country code'],
          },
          taxType: { type: String, required: true },
          rate: { type: Number, required: true, min: 0 },
          amount: { type: Number, required: true, min: 0 },
          _id: false,
        },
      ],
      taxService: {
        type: String,
        default: 'none',
      },
      transactionId: { type: String, trim: true },
      _id: false,
    },
    integrations: [
      {
        providerId: {
          type: Schema.Types.Mixed,
          ref: 'Integration',
          required: [true, 'Provider ID is required'],
          trim: true,
        },
        type: {
          type: String,
          enum: [
        'payment' , 'warehouse' , 'dropshipping' , 'marketplace' , 'shipping' , 'marketing' , 'accounting' , 'crm' , 'analytics' , 'automation' , 'communication' , 'education' , 'security' , 'advertising' , 'tax' , 'other',
          ],
          required: [true, 'Integration type is required'],
        },
        providerName: {
          type: String,
          required: [true, 'Provider name is required'],
          trim: true,
        },
        externalOrderId: { type: String, trim: true },
        status: { type: String, trim: true },
        metadata: { type: Schema.Types.Mixed, default: {} },
        _id: false,
      },
    ],
    webhookTriggered: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
    externalOrderId: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance optimization
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, status: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ fulfillmentStatus: 1 });
orderSchema.index({ paymentGatewayId: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ 'shippingAddress.countryCode': 1 });
orderSchema.index({ 'taxDetails.taxService': 1 });
orderSchema.index({ 'integrations.providerId': 1 });

// Pre-save hook to calculate prices
orderSchema.pre('save', function (next) {
  if (this.isModified('items')) {
    this.itemsPrice = this.items.reduce((total, item) => total + item.price * item.quantity, 0);
  }
  if (this.isModified('itemsPrice') || this.isModified('taxAmount') || this.isModified('shippingAmount')) {
    this.totalPrice = this.itemsPrice + this.taxAmount + this.shippingAmount;
  }
  next();
});

export const Order: Model<IOrder> = mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);