import { Schema, model, models, Document } from 'mongoose';
import { PaymentMethod, FulfillmentTracking } from '@/lib/api/types';

export interface IOrder extends Document {
  userId: string;
  sellerId: string;
  items: Array<{
    productId: string;
    name: string;
    slug: string;
    image: string;
    price: number;
    quantity: number;
    color: string;
    size?: string;
  }>;
  itemsPrice: number;
  paymentMethod: PaymentMethod;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'abandoned';
  fulfillmentStatus: 'pending' | 'processing' | 'shipped' | 'delivered' | 'failed';
  trackingInfo?: FulfillmentTracking;
  webhookTriggered: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      index: true,
      trim: true,
    },
    sellerId: {
      type: String,
      required: [true, 'Seller ID is required'],
      index: true,
      trim: true,
    },
    items: [
      {
        productId: {
          type: String,
          required: [true, 'Product ID is required'],
          trim: true,
        },
        name: {
          type: String,
          required: [true, 'Item name is required'],
          trim: true,
        },
        slug: {
          type: String,
          required: [true, 'Item slug is required'],
          trim: true,
        },
        image: {
          type: String,
          required: [true, 'Item image is required'],
          match: [/^https?:\/\/.*\.(?:png|jpg|jpeg|webp)$/, 'Please provide a valid image URL'],
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
        color: {
          type: String,
          required: [true, 'Item color is required'],
          trim: true,
        },
        size: {
          type: String,
          trim: true,
        },
        _id: false,
      },
    ],
    itemsPrice: {
      type: Number,
      required: [true, 'Items price is required'],
      min: [0, 'Items price cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['stripe', 'paypal', 'bank_transfer'],
        message: '{VALUE} is not a valid payment method',
      },
      required: [true, 'Payment method is required'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'abandoned'],
        message: '{VALUE} is not a valid status',
      },
      default: 'pending',
    },
    fulfillmentStatus: {
      type: String,
      enum: {
        values: ['pending', 'processing', 'shipped', 'delivered', 'failed'],
        message: '{VALUE} is not a valid fulfillment status',
      },
      default: 'pending',
    },
    trackingInfo: {
      carrier: { type: String, trim: true },
      trackingNumber: { type: String, trim: true },
      trackingUrl: { type: String, trim: true },
      estimatedDeliveryDate: { type: String, trim: true },
      status: { type: String, trim: true },
      statusDetails: { type: String, trim: true },
      lastUpdated: { type: String, trim: true },
    },
    webhookTriggered: {
      type: Boolean,
      default: false,
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

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ sellerId: 1, status: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ fulfillmentStatus: 1 });

orderSchema.pre('save', function (next) {
  if (this.isModified('items')) {
    this.itemsPrice = this.items.reduce((total, item) => total + item.price * item.quantity, 0);
  }
  next();
});

const Order = models.Order || model<IOrder>('Order', orderSchema);

export default Order;