import { Schema, model, models, Document, Types } from 'mongoose';
import SellerIntegration from './seller-integration.model';

interface Review {
  user: string;
  name?: string;
  rating: number;
  title?: string;
  comment?: string;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WarehouseSize {
  name: string;
  quantity: number;
  inStock: boolean;
}

interface WarehouseColor {
  name: string;
  hex?: string;
  quantity: number;
  inStock: boolean;
  sizes: WarehouseSize[];
}

interface Dimensions {
  length: number;
  width: number;
  height: number;
}

interface WarehouseStock {
  warehouseId: string;
  provider: string;
  sku: string;
  quantity: number;
  location?: string;
  minimumStock: number;
  reorderPoint: number;
  colors: WarehouseColor[];
  lastUpdated: Date;
  updatedBy?: string;
  dimensions?: Dimensions;
  weight?: number;
}

interface Marketplace {
  platform: string;
  sku: string;
  externalId: string;
  status: 'active' | 'pending' | 'inactive';
  lastSynced: Date;
}

interface Section {
  id: string;
  type: 'text' | 'image' | 'video' | 'button' | 'carousel' | 'countdown' | 'reviews';
  content: Record<string, any>;
  position: number;
}

interface Translation {
  locale: string;
  name: string;
  description: string;
}

interface WebhookEvent {
  event: string;
  provider: string;
  timestamp: Date;
  payload: Record<string, any>;
}

const reviewSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
  },
  name: {
    type: String,
    trim: true,
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters'],
  },
  isVerifiedPurchase: {
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
}, { _id: false });

const warehouseSizeSchema = new Schema({
  name: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  inStock: { type: Boolean, default: true },
}, { _id: false });

const warehouseColorSchema = new Schema({
  name: { type: String, required: true, trim: true },
  hex: {
    type: String,
    match: [/^#[0-9A-F]{6}$/i, 'Please provide a valid hex color'],
  },
  quantity: { type: Number, required: true, min: 0 },
  inStock: { type: Boolean, default: true },
  sizes: [warehouseSizeSchema],
}, { _id: false });

const dimensionsSchema = new Schema({
  length: { type: Number, min: 0, default: 0 },
  width: { type: Number, min: 0, default: 0 },
  height: { type: Number, min: 0, default: 0 },
}, { _id: false });

const warehouseStockSchema = new Schema({
  warehouseId: {
    type: String,
    required: [true, 'Warehouse ID is required'],
  },
  provider: {
    type: String,
    required: [true, 'Provider is required'],
    trim: true,
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    trim: true,
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0,
  },
  location: {
    type: String,
    trim: true,
  },
  minimumStock: {
    type: Number,
    default: 5,
    min: [0, 'Minimum stock cannot be negative'],
  },
  reorderPoint: {
    type: Number,
    default: 10,
    min: [0, 'Reorder point cannot be negative'],
  },
  colors: [warehouseColorSchema],
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: String,
    trim: true,
  },
  dimensions: { type: dimensionsSchema, required: false },
  weight: { type: Number, min: 0, default: 0 },
}, { _id: false });

const marketplaceSchema = new Schema({
  platform: {
    type: String,
    required: [true, 'Platform is required'],
    trim: true,
  },
  sku: {
    type: String,
    required: true,
    trim: true,
  },
  externalId: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'inactive'],
    default: 'pending',
  },
  lastSynced: {
    type: Date,
    required: true,
  },
}, { _id: false });

const sectionSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'button', 'carousel', 'countdown', 'reviews'],
    required: true,
  },
  content: {
    type: Schema.Types.Mixed,
    required: true,
  },
  position: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const translationSchema = new Schema({
  locale: {
    type: String,
    required: true,
    trim: true,
    match: [/^[a-z]{2}$/, 'Locale must be a 2-letter code (e.g., en, ar)'],
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
  },
}, { _id: false });

const webhookEventSchema = new Schema({
  event: {
    type: String,
    required: true,
    trim: true,
  },
  provider: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  payload: {
    type: Schema.Types.Mixed,
    required: true,
  },
}, { _id: false });

const productSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
  },
  slug: {
    type: String,
    required: [true, 'Slug is required'],
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [10, 'Description must be at least 10 characters'],
  },
  translations: [translationSchema],
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
  },
  images: [{
    type: String,
    required: [true, 'Image is required'],
    match: [/^https?:\/\/.*\.(?:png|jpg|jpeg|webp)$/, 'Please provide a valid image URL'],
  }],
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  listPrice: {
    type: Number,
    required: [true, 'List price is required'],
    min: [0, 'List price cannot be negative'],
  },
  countInStock: {
    type: Number,
    required: [true, 'Stock count is required'],
    min: [0, 'Stock count cannot be negative'],
    default: 0,
  },
  numReviews: {
    type: Number,
    default: 0,
    min: [0, 'Number of reviews cannot be negative'],
  },
  reviews: [reviewSchema],
  tags: [{
    type: String,
    trim: true,
  }],
  sizes: [{
    type: String,
    trim: true,
  }],
  finalPrice: { type: Number, required: true },
  featured: {
    type: Boolean,
    default: false,
  },
  isPublished: {
    type: Boolean,
    default: false,
  },
  sellerId: {
    type: Schema.Types.ObjectId,
    ref: 'Seller',
    required: [true, 'Seller ID is required'],
  },
  warehouseData: [warehouseStockSchema],
  marketplaces: [marketplaceSchema],
  sections: [sectionSchema],
  relatedProducts: [{
    type: Schema.Types.ObjectId,
    ref: 'Product',
  }],
  webhookEvents: [webhookEventSchema],
  pricing: {
    basePrice: {
      type: Number,
      min: [0, 'Base price cannot be negative'],
      required: true,
    },
    markup: {
      type: Number,
      min: [0, 'Markup cannot be negative'],
      required: true,
    },
    profit: {
      type: Number,
      min: [0, 'Profit cannot be negative'],
      required: true,
    },
    commission: {
      type: Number,
      min: [0, 'Commission cannot be negative'],
      required: true,
    },
    finalPrice: {
      type: Number,
      min: [0, 'Final price cannot be negative'],
      required: true,
    },
    discount: {
      type: {
        type: String,
        enum: ['none', 'percentage', 'fixed'],
        default: 'none',
        required: true,
      },
      value: {
        type: Number,
        default: 0,
        min: [0, 'Discount value cannot be negative'],
        required: true,
        validate: {
          validator: function (this: { type: string; value: number }, v: number) {
            return this.type !== 'percentage' || v <= 100;
          },
          message: 'Percentage discount cannot exceed 100%',
        },
      },
      startDate: {
        type: Date,
        validate: {
          validator: function (this: { endDate?: Date; startDate?: Date }, v: Date) {
            return !this.endDate || !this.startDate || this.startDate <= this.endDate;
          },
          message: 'Start date must be before or equal to end date',
        },
      },
      endDate: {
        type: Date,
      },
    },
  },
  metrics: {
    views: {
      type: Number,
      default: 0,
      min: [0, 'Views cannot be negative'],
    },
    sales: {
      type: Number,
      default: 0,
      min: [0, 'Sales cannot be negative'],
    },
    revenue: {
      type: Number,
      default: 0,
      min: [0, 'Revenue cannot be negative'],
    },
    returns: {
      type: Number,
      default: 0,
      min: [0, 'Returns cannot be negative'],
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
    },
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'active', 'rejected', 'suspended'],
    default: 'draft',
  },
  inventoryStatus: {
    type: String,
    enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'],
    default: 'OUT_OF_STOCK',
  },
  adminReview: {
    approved: {
      type: Boolean,
      default: false,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  ratingDistribution: [{
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    count: {
      type: Number,
      min: 0,
    },
    _id: false,
  }],
  createdBy: {
    type: String,
    trim: true,
  },
  updatedBy: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

productSchema.index({ sellerId: 1, slug: 1 });
productSchema.index({ category: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ 'warehouseData.provider': 1 });
productSchema.index({ 'marketplaces.platform': 1 });

productSchema.virtual('avgRating').get(function () {
  return this.reviews.length > 0
    ? Math.round(
        this.reviews.reduce((sum: number, review: any) => sum + review.rating, 0) /
          this.reviews.length * 10
      ) / 10
    : 0;
});

productSchema.virtual('colors').get(function () {
  const allColors = new Map();
  this.warehouseData.forEach((wh: any) => {
    wh.colors.forEach((color: any) => {
      if (!allColors.has(color.name)) {
        allColors.set(color.name, {
          name: color.name,
          hex: color.hex,
          quantity: color.quantity,
          inStock: color.inStock,
          sizes: color.sizes,
        });
      } else {
        const existing = allColors.get(color.name);
        existing.quantity += color.quantity;
        existing.inStock = existing.inStock || color.inStock;
        existing.sizes = [
          ...new Map(
            [...existing.sizes, ...color.sizes].map((size) => [size.name, size])
          ).values(),
        ];
      }
    });
  });
  return Array.from(allColors.values());
});

productSchema.pre('save', async function (this: any, next) {
  // Update rating distribution and metrics
  if (this.isModified('reviews')) {
    const distribution = Array(5).fill(0);
    this.reviews.forEach((review: any) => {
      distribution[review.rating - 1]++;
    });
    this.ratingDistribution = distribution.map((count, index) => ({
      rating: index + 1,
      count,
    }));
    this.numReviews = this.reviews.length;
    this.metrics = this.metrics || {
      views: 0,
      sales: 0,
      revenue: 0,
      returns: 0,
      rating: 0,
    };
    this.metrics.rating = this.avgRating;
  }

  // Update stock and inventory status
  if (this.isModified('warehouseData')) {
    this.countInStock = this.warehouseData.reduce(
      (sum: number, wh: any) => sum + wh.quantity,
      0
    );
    this.inventoryStatus =
      this.countInStock === 0
        ? 'OUT_OF_STOCK'
        : this.countInStock <=
          Math.min(...this.warehouseData.map((wh: any) => wh.minimumStock))
        ? 'LOW_STOCK'
        : 'IN_STOCK';
  }

  // Validate discount dates
  if (this.isModified('pricing.discount')) {
    const discount = this.pricing?.discount;
    if (discount && discount.type !== 'none' && (!discount.startDate || !discount.endDate)) {
      return next(new Error('Discount start and end dates are required when discount is applied'));
    }
  }

  next();
});

productSchema.pre('save', async function (next) {
  // Validate warehouse providers
  const sellerIntegrations = await SellerIntegration.find({
    sellerId: this.sellerId,
    status: 'connected',
  }).populate('integrationId');
  const validProviders = sellerIntegrations.map((si: any) => si.integrationId.providerName);
  const invalidWarehouses = this.warehouseData.filter(
    (wh: any) => !validProviders.includes(wh.provider)
  );
  if (invalidWarehouses.length > 0) {
    return next(
      new Error(
        `Invalid warehouse providers: ${invalidWarehouses
          .map((wh: any) => wh.provider)
          .join(', ')}`
      )
    );
  }
  next();
});

export interface IReview {
  user: string; // MongoDB ObjectId as string
  name: string;
  rating: number;
  comment: string;
  createdAt: Date;
}
export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  translations: Translation[];
  category: string;
  brand: string;
  images: string[];
  price: number;
  listPrice: number;
  finalPrice: number;
  countInStock: number;
  numReviews: number;
  reviews: Review[];
    source?: {
    providerId: Types.ObjectId;
    productId: string;
  };
  tags: string[];
  sizes: string[];
  featured: boolean;
  isPublished: boolean;
  sellerId: string;
  warehouseData: WarehouseStock[];
  marketplaces: Marketplace[];
  sections: Section[];
  relatedProducts: string[];
  webhookEvents: WebhookEvent[];
  pricing: {
    basePrice: number;
    markup: number;
    profit: number;
    commission: number;
    finalPrice: number;
    discount?: {
      type: 'none' | 'percentage' | 'fixed';
      value: number;
      startDate?: Date;
      endDate?: Date;
    };
  };
  warehouse?: {
    providerName: string;
    sku: string;
    externalId: string;
    availableQuantity: number;
    location: string;
    lastSync: Date;
    dimensions?: {
      length: number;
      width: number;
      height: number;
      unit: string;
    };
    weight?: {
      value: number;
      unit: string;
    };
    provider: string;

  };
  metrics: {
    views: number;
    sales: number;
    revenue: number;
    returns: number;
    rating: number;
  };
  status: 'draft' | 'pending' | 'active' | 'rejected' | 'suspended';
  inventoryStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  adminReview?: {
    approved: boolean;
    reviewedAt: Date;
    reviewedBy: string;
    notes?: string;
  };
  ratingDistribution: Array<{
    rating: number;
    count: number;
  }>;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  avgRating: number;
  colors: Array<{
    name: string;
    hex: string;
    quantity: number;
    inStock: boolean;
    sizes: Array<{
      name: string;
      quantity: number;
      inStock: boolean;
    }>;
  }>;
}

const Product = models.Product || model<IProduct>('Product', productSchema);
export default Product;