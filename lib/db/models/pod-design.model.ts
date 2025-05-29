
import { Document, Model, model, models, Schema } from 'mongoose'

export type DesignFormat = 'svg' | 'png' | 'pdf' | 'ai' | 'psd'
export type DesignCategory = 'apparel' | 'accessories' | 'home-decor' | 'stationery' | 'other'
export type DesignSize = 'xs' | 's' | 'm' | 'l' | 'xl' | '2xl' | '3xl'

export interface IDesignFile {
  preview: string
  source: string
  format: DesignFormat
  size?: {
    width: number
    height: number
    unit: 'px' | 'in' | 'cm'
  }
  metadata?: {
    dpi?: number
    colorSpace?: 'rgb' | 'cmyk'
    layersCount?: number
  }
}

export interface IDesignProduct {
  productId: Schema.Types.ObjectId
  variant: string
  price: number
  isActive: boolean
  sizes?: DesignSize[]
  colors?: string[]
  printAreas?: string[]
  mockups?: string[]
  minimumOrder?: number
  shippingTime?: number
}

export interface IPODDesign extends Document {
  _id: string
  sellerId: Schema.Types.ObjectId
  name: string
  description?: string
  category: DesignCategory
  images: string[]
  files: IDesignFile[]
  tags: string[]
  isPublished: boolean
  products: IDesignProduct[]
  stats?: {
    views: number
    likes: number
    shares: number
    downloads: number
    sales: number
    revenue: number
  }
  settings?: {
    visibility: 'public' | 'private' | 'unlisted'
    allowDownload: boolean
    license: 'standard' | 'extended' | 'exclusive'
    customization: boolean
  }
  metadata?: {
    originalFormat: DesignFormat
    dimensions: {
      width: number
      height: number
      unit: 'px' | 'in' | 'cm'
    }
    fileSize: number
    colors: string[]
    fonts: string[]
  }
  reviews?: Array<{
    userId: Schema.Types.ObjectId
    rating: number
    comment: string
    createdAt: Date
  }>
  createdAt: Date
  updatedAt: Date
}

const designFileSchema = new Schema<IDesignFile>({
  preview: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    required: true,
  },
  format: {
    type: String,
    enum: ['svg', 'png', 'pdf', 'ai', 'psd'],
    required: true,
  },
  size: {
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['px', 'in', 'cm'],
    },
  },
  metadata: {
    dpi: Number,
    colorSpace: {
      type: String,
      enum: ['rgb', 'cmyk'],
    },
    layersCount: Number,
  },
})

const designProductSchema = new Schema<IDesignProduct>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  variant: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  sizes: [{
    type: String,
    enum: ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl'],
  }],
  colors: [String],
  printAreas: [String],
  mockups: [String],
  minimumOrder: {
    type: Number,
    default: 1,
    min: 1,
  },
  shippingTime: {
    type: Number,
    min: 0,
  },
})

const podDesignSchema = new Schema<IPODDesign>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      enum: ['apparel', 'accessories', 'home-decor', 'stationery', 'other'],
      required: true,
      index: true,
    },
    images: [{
      type: String,
      validate: {
        validator: (v: string) => /^https?:\/\/.+/.test(v),
        message: 'Invalid image URL',
      },
    }],
    files: [designFileSchema],
    tags: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    products: [designProductSchema],
    stats: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
      sales: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
    },
    settings: {
      visibility: {
        type: String,
        enum: ['public', 'private', 'unlisted'],
        default: 'public',
      },
      allowDownload: {
        type: Boolean,
        default: false,
      },
      license: {
        type: String,
        enum: ['standard', 'extended', 'exclusive'],
        default: 'standard',
      },
      customization: {
        type: Boolean,
        default: true,
      },
    },
    metadata: {
      originalFormat: {
        type: String,
        enum: ['svg', 'png', 'pdf', 'ai', 'psd'],
      },
      dimensions: {
        width: Number,
        height: Number,
        unit: {
          type: String,
          enum: ['px', 'in', 'cm'],
        },
      },
      fileSize: Number,
      colors: [String],
      fonts: [String],
    },
    reviews: [{
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
      },
      rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
      },
      comment: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  {
    timestamps: true,
  }
)

// Indexes
podDesignSchema.index({ name: 'text', description: 'text', tags: 'text' })
podDesignSchema.index({ 'stats.views': -1 })
podDesignSchema.index({ 'stats.sales': -1 })
podDesignSchema.index({ createdAt: -1 })

// Methods
podDesignSchema.methods.incrementStats = function(field: keyof IPODDesign['stats'], amount = 1) {
  if (this.stats && field in this.stats) {
    this.stats[field] += amount
    return this.save()
  }
}

// Statics
podDesignSchema.statics.findByTags = function(tags: string[]) {
  return this.find({ tags: { $in: tags } })
}

podDesignSchema.statics.findPopular = function() {
  return this.find({ isPublished: true })
    .sort({ 'stats.views': -1, 'stats.sales': -1 })
    .limit(10)
}

// Middleware
podDesignSchema.pre('save', function(next) {
  if (this.isModified('products')) {
    // Update stats when products change
    const totalSales = this.products.reduce((sum, product) => sum + (product.price || 0), 0)
    if (!this.stats) {
      this.stats = {
        views: 0,
        likes: 0,
        shares: 0,
        downloads: 0,
        sales: 0,
        revenue: 0
      }
    }
    this.stats.revenue = totalSales
  }
  next()
})

const PODDesign = (models.PODDesign as Model<IPODDesign>) || 
  model<IPODDesign>('PODDesign', podDesignSchema)

export default PODDesign