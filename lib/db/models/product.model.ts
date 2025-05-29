import { Schema, model, models, Document } from 'mongoose';

const warehouseStockSchema = new Schema({
  warehouseId: {
    type: String,
    required: [true, 'Warehouse ID is required'],
  },
  provider: {
    type: String,
    required: [true, 'Provider is required'],
    enum: {
      values: ['ShipBob', '4PX'],
      message: '{VALUE} is not a valid warehouse provider',
    },
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
  colors: [{
    name: { type: String, required: true },
    hex: {
      type: String,
      match: [/^#[0-9A-F]{6}$/i, 'Please provide a valid hex color'],
    },
    quantity: { type: Number, required: true, min: 0 },
    inStock: { type: Boolean, default: true },
    sizes: [{
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 0 },
      inStock: { type: Boolean, default: true },
      _id: false,
    }],
    _id: false,
  }],
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
  updatedBy: {
    type: String,
    trim: true,
  },
}, { _id: false });

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
  },
  comment: {
    type: String,
    trim: true,
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

const marketplaceSchema = new Schema({
  platform: {
    type: String,
    enum: {
      values: ['Amazon', 'AliExpress', 'Shopify'],
      message: '{VALUE} is not a valid marketplace platform',
    },
    required: true,
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
  rating: {
    type: Number,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5'],
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
  colors: [{
    name: { type: String, required: true },
    hex: {
      type: String,
      match: [/^#[0-9A-F]{6}$/i, 'Please provide a valid hex color'],
    },
    quantity: { type: Number, required: true, min: 0 },
    inStock: { type: Boolean, default: true },
    sizes: [{
      name: { type: String, required: true },
      quantity: { type: Number, required: true, min: 0 },
      inStock: { type: Boolean, default: true },
      _id: false,
    }],
    _id: false,
  }],
  sizes: [{
    type: String,
    trim: true,
  }],
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
  },
  warehouseData: [warehouseStockSchema],
  marketplaces: [marketplaceSchema],
  pricing: {
    basePrice: {
      type: Number,
      min: [0, 'Base price cannot be negative'],
    },
    markup: {
      type: Number,
      min: [0, 'Markup cannot be negative'],
    },
    profit: {
      type: Number,
      min: [0, 'Profit cannot be negative'],
    },
    commission: {
      type: Number,
      min: [0, 'Commission cannot be negative'],
    },
    finalPrice: {
      type: Number,
      min: [0, 'Final price cannot be negative'],
    },
    discount: {
      type: {
        type: String,
        enum: {
          values: ['none', 'percentage', 'fixed'],
          message: '{VALUE} is not a valid discount type',
        },
        default: 'none',
      },
      value: {
        type: Number,
        default: 0,
        min: [0, 'Discount value cannot be negative'],
      },
      startDate: {
        type: Date,
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
    enum: {
      values: ['draft', 'pending', 'active', 'rejected', 'suspended'],
      message: '{VALUE} is not a valid status',
    },
    default: 'draft',
  },
  inventoryStatus: {
    type: String,
    enum: {
      values: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'],
      message: '{VALUE} is not a valid inventory status',
    },
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

productSchema.virtual('avgRating').get(function() {
  return this.reviews.length > 0
    ? Math.round(this.reviews.reduce((sum: number, review: any) => sum + review.rating, 0) / this.reviews.length * 10) / 10
    : 0;
});

productSchema.pre('save', async function(next) {
  if (this.isModified('reviews')) {
    const distribution = Array(5).fill(0);
    this.reviews.forEach((review: any) => {
      distribution[review.rating - 1]++;
    });
    this.ratingDistribution = distribution.map((count, index) => ({
      rating: index + 1,
      count,
    }));
    this.metrics.rating = this.avgRating;
    this.numReviews = this.reviews.length;
  }

  if (this.isModified('warehouseData')) {
    this.countInStock = this.warehouseData.reduce((sum: number, wh: any) => sum + wh.quantity, 0);
    this.inventoryStatus = this.countInStock === 0
      ? 'OUT_OF_STOCK'
      : this.countInStock <= Math.min(...this.warehouseData.map((wh: any) => wh.minimumStock))
        ? 'LOW_STOCK'
        : 'IN_STOCK';
  }

  next();
});

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  category: string;
  brand: string;
  images: string[];
  price: number;
  listPrice: number;
  countInStock: number;
  rating: number;
  numReviews: number;
  reviews: any[];
  tags: string[];
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
  sizes: string[];
  featured: boolean;
  isPublished: boolean;
  sellerId?: string;
  warehouseData: Array<{
    warehouseId: string;
    provider: 'ShipBob' | '4PX';
    sku: string;
    quantity: number;
    location?: string;
    minimumStock: number;
    reorderPoint: number;
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
    lastUpdated: Date;
    updatedBy?: string;
  }>;
  marketplaces: Array<{
    platform: 'Amazon' | 'AliExpress' | 'Shopify';
    sku: string;
    externalId: string;
    status: 'active' | 'pending' | 'inactive';
    lastSynced: Date;
  }>;
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
}

const Product = models.Product || model<IProduct>('Product', productSchema);
export default Product;