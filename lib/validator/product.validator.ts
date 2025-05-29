import { z } from 'zod'
import { WarehouseBaseSchema, ColorSchema } from '../schemas/warehouse.schema'

// Common Validators
const MongoId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid MongoDB ID' })

const Price = (field: string) =>
  z.coerce
    .number()
    .min(0, `${field} must be non-negative`)
    .transform(val => Number(val.toFixed(2)))

// Product Schemas
const ProductSellerSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  subscription: z.string(),
}).optional()

const ProductDiscountSchema = z.object({
  type: z.enum(['none', 'percentage', 'fixed']).default('none'),
  value: z.number().min(0).default(0),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
}).optional()

const ProductPricingSchema = z.object({
  basePrice: z.number().min(0),
  markup: z.number().min(0),
  profit: z.number(),
  commission: z.number().min(0),
  finalPrice: z.number().min(0),
  discount: ProductDiscountSchema,
}).optional()

const ProductMetricsSchema = z.object({
  views: z.number().min(0).default(0),
  sales: z.number().min(0).default(0),
  revenue: z.number().min(0).default(0),
  returns: z.number().min(0).default(0),
  rating: z.number().min(0).max(5).default(0),
}).optional()

export const ReviewInputSchema = z.object({
  product: MongoId,
  user: MongoId,
  isVerifiedPurchase: z.boolean(),
  title: z.string().min(1, 'Title is required'),
  comment: z.string().min(1, 'Comment is required'),
  rating: z.coerce
    .number()
    .int()
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
})

// Main Product Schema
export const ProductInputSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  slug: z.string().min(3, 'Slug must be at least 3 characters'),
  category: z.string().min(1, 'Category is required'),
  images: z.array(z.string().url('Invalid image URL')).min(1, 'At least one image is required'),
  brand: z.string().min(1, 'Brand is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().min(0, 'Price must be positive'),
  listPrice: z.number().min(0, 'List price must be positive'),
  countInStock: z.number().int().min(0, 'Stock must be positive'),
  tags: z.array(z.string()).default(['new arrival']),
  colors: z.array(ColorSchema).default([]),
  sizes: z.array(z.string()).default(['S', 'M', 'L', 'XL', 'XXL']),
  isPublished: z.boolean().default(false),
  featured: z.boolean().default(false),
  warehouse: WarehouseBaseSchema.extend({
    provider: z.enum(['ShipBob', '4PX'], { required_error: 'Warehouse provider is required' }),
  }),
  warehouseData: z.array(z.object({
    warehouseId: z.string().min(1, 'Warehouse ID is required'),
    sku: z.string().min(1, 'SKU is required'),
    quantity: z.number().min(0),
    location: z.string(),
    minimumStock: z.number().min(0).default(5),
    reorderPoint: z.number().min(0).default(10),
    colors: z.array(ColorSchema).optional(),
    lastUpdated: z.date().optional(),
    updatedBy: z.string().optional(),
  })).min(1, 'At least one warehouse is required'),
  metrics: ProductMetricsSchema,
  pricing: ProductPricingSchema,
  seller: ProductSellerSchema,
  sellerId: MongoId.optional(),
  status: z.enum(['draft', 'pending', 'active', 'rejected', 'suspended']).default('draft'),
  inventoryStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).default('OUT_OF_STOCK'),
  avgRating: z.number().min(0).max(5).optional(),
  numReviews: z.number().int().min(0).optional(),
  ratingDistribution: z.array(
    z.object({
      rating: z.number().min(1).max(5),
      count: z.number().min(0)
    })
  ).max(5).optional(),
  reviews: z.array(ReviewInputSchema).default([]),
  adminReview: z.object({
    approved: z.boolean(),
    reviewedAt: z.date(),
    reviewedBy: z.string(),
    notes: z.string().optional()
  }).optional(),
  createdBy: z.string().optional(),
  updatedBy: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

// Product Update Schema
export const ProductUpdateSchema = ProductInputSchema.extend({
  _id: MongoId,
})

// Export type
export type ProductInput = z.infer<typeof ProductInputSchema>

// Price Related Schemas
export const PriceInputSchema = z.object({
  basePrice: z.number().min(0),
  markup: z.number().min(0),
  discount: z.object({
    type: z.enum(['none', 'percentage', 'fixed']),
    value: z.number().min(0),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }).optional(),
})

export const InventoryInputSchema = z.object({
  quantity: z.number().int().min(0),
  minimumStock: z.number().int().min(0),
  reorderPoint: z.number().int().min(0),
  location: z.string().optional(),
})

// Validation Functions
export const validateProductData = (data: unknown) => {
  return ProductInputSchema.safeParse(data)
}

export const validateProductUpdate = (data: unknown) => {
  return ProductUpdateSchema.safeParse(data)
}

export const validatePricing = (data: unknown) => {
  return PriceInputSchema.safeParse(data)
}

export const validateInventory = (data: unknown) => {
  return InventoryInputSchema.safeParse(data)
}

// Custom Validators
export const isValidPrice = (price: number): boolean => {
  return price >= 0 && Number.isFinite(price)
}

export const isValidStock = (stock: number): boolean => {
  return Number.isInteger(stock) && stock >= 0
}

export const isValidDiscount = (
  discount: { type: string; value: number; startDate?: Date; endDate?: Date }
): boolean => {
  if (!['none', 'percentage', 'fixed'].includes(discount.type)) return false
  if (discount.value < 0) return false
  if (discount.type === 'percentage' && discount.value > 100) return false
  if (discount.startDate && discount.endDate && discount.startDate > discount.endDate) return false
  return true
}

// Validation Error Messages
export const ValidationErrors = {
  INVALID_PRICE: 'Price must be a non-negative number',
  INVALID_STOCK: 'Stock quantity must be a non-negative integer',
  INVALID_DISCOUNT: 'Invalid discount configuration',
  MISSING_WAREHOUSE: 'At least one warehouse is required',
  INVALID_IMAGES: 'At least one valid image URL is required',
  INVALID_SIZES: 'Invalid size configuration',
  INVALID_COLORS: 'Invalid color configuration',
}

// Export all
export default {
  ProductInputSchema,
  ProductUpdateSchema,
  validateProductData,
  validateProductUpdate,
  validatePricing,
  validateInventory,
  isValidPrice,
  isValidStock,
  isValidDiscount,
  ValidationErrors,
}