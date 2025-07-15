import { z } from 'zod';
import { WarehouseBaseSchema, ColorSchema } from '../schemas/warehouse.schema';
import { getTranslations } from 'next-intl/server';

// Common Validators
const MongoId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: 'Invalid MongoDB ID' });

const Price = (field: string) =>
  z.coerce
    .number()
    .min(0, `${field} must be non-negative`)
    .transform(val => Number(val.toFixed(2)));

const Currency = z.string().regex(/^[A-Z]{3}$/, 'Invalid currency code (ISO 4217)');

// Product Schemas
const ProductSellerSchema = z.object({
  name: z.string().min(1, 'Seller name is required'),
  email: z.string().email('Invalid email format'),
  subscription: z.string().optional(),
});

const ProductDiscountSchema = z.object({
  type: z.enum(['none', 'percentage', 'fixed']).default('none'),
  value: z.number().min(0).default(0),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
});

const ProductPricingSchema = z.object({
  basePrice: Price('Base price'),
  markup: Price('Markup'),
  profit: Price('Profit'),
  commission: Price('Commission'),
  finalPrice: Price('Final price'),
  currency: Currency.default('USD'),
  discount: ProductDiscountSchema,
});

const ProductMetricsSchema = z.object({
  views: z.number().min(0).default(0),
  sales: z.number().min(0).default(0),
  revenue: z.number().min(0).default(0),
  returns: z.number().min(0).default(0),
  rating: z.number().min(0).max(5).default(0),
});

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
});

// مخطط استيراد المنتجات (للدروب شيبنج)
export const ProductImportSchema = z.object({
  productId: z.string().nonempty('Product ID is required'),
  title: z.string().min(3, 'Product name must be at least 3 characters'),
  description: z.string().optional(),
  price: Price('Price'),
  images: z.array(z.string().url('Invalid image URL')).optional(),
  sku: z.string().nonempty('SKU is required'),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  source: z.string().nonempty('Source is required'),
  sourceId: z.string().nonempty('Source ID is required'),
  sourceStoreId: z.string().nonempty('Source store ID is required'),
  currency: Currency,
  availability: z.enum(['in_stock', 'out_of_stock']).default('in_stock'),
  categories: z.array(z.string()).optional(),
  region: z.string().optional(),
});

// Main Product Schema
export const ProductInputSchema = async () => {
  const t = await getTranslations('product.validation');
  return z.object({
    name: z.string().min(3, t('name_min')),
    slug: z.string().min(3, t('slug_min')),
    category: z.string().min(1, t('category_required')),
    images: z.array(z.string().url(t('invalid_image_url'))).min(1, t('images_min')),
    brand: z.string().min(1, t('brand_required')),
    description: z.string().min(10, t('description_min')),
    price: Price(t('price_positive')),
    listPrice: Price(t('list_price_positive')),
    countInStock: z.number().int().min(0, t('stock_positive')),
    tags: z.array(z.string()).default(['new arrival']),
    colors: z.array(ColorSchema).default([]),
    sizes: z.array(z.string()).default(['S', 'M', 'L', 'XL', 'XXL']),
    isPublished: z.boolean().default(false),
    featured: z.boolean().default(false),
    warehouse: WarehouseBaseSchema.extend({
      provider: z.string().min(1, t('warehouse_provider_required')).optional(),
    }).optional(),
    warehouseData: z.array(
      z.object({
        warehouseId: z.string().min(1, t('warehouse_id_required')).optional(),
        sku: z.string().min(1, t('sku_required')),
        quantity: z.number().min(0, t('quantity_positive')),
        location: z.string().optional(),
        minimumStock: z.number().min(0).default(5),
        reorderPoint: z.number().min(0).default(10),
        colors: z.array(ColorSchema).optional(),
        lastUpdated: z.date().optional(),
        updatedBy: z.string().optional(),
      })
    ).optional(),
    source: z.string().optional(), // حقول دروب شيبنج
    sourceId: z.string().optional(),
    sourceStoreId: z.string().optional(),
    region: z.string().optional(),
    metrics: ProductMetricsSchema,
    pricing: ProductPricingSchema,
    seller: ProductSellerSchema.optional(),
    sellerId: MongoId.optional(),
    status: z.enum(['draft', 'pending', 'active', 'rejected', 'suspended']).default('draft'),
    inventoryStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).default('OUT_OF_STOCK'),
    avgRating: z.number().min(0).max(5).optional(),
    numReviews: z.number().int().min(0).optional(),
    ratingDistribution: z.array(
      z.object({
        rating: z.number().min(1).max(5),
        count: z.number().min(0),
      })
    ).max(5).optional(),
    reviews: z.array(ReviewInputSchema).default([]),
    adminReview: z.object({
      approved: z.boolean(),
      reviewedAt: z.date(),
      reviewedBy: z.string(),
      notes: z.string().optional(),
    }).optional(),
    createdBy: z.string().optional(),
    updatedBy: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  });
};

// Product Update Schema
export const ProductUpdateSchema = async () => {
  const schema = await ProductInputSchema();
  return schema.extend({
    _id: MongoId,
  });
};

// Price and Inventory Schemas
export const PriceInputSchema = z.object({
  basePrice: Price('Base price'),
  markup: Price('Markup'),
  discount: z.object({
    type: z.enum(['none', 'percentage', 'fixed']),
    value: z.number().min(0),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
  }).optional(),
});

export const InventoryInputSchema = z.object({
  quantity: z.number().int().min(0),
  minimumStock: z.number().int().min(0),
  reorderPoint: z.number().int().min(0),
  location: z.string().optional(),
});

// Validation Functions
export const validateProductData = async (data: unknown) => {
  const schema = await ProductInputSchema();
  return schema.safeParse(data);
};

export const validateProductUpdate = async (data: unknown) => {
  const schema = await ProductUpdateSchema();
  return schema.safeParse(data);
};

export const validatePricing = (data: unknown) => {
  return PriceInputSchema.safeParse(data);
};

export const validateInventory = (data: unknown) => {
  return InventoryInputSchema.safeParse(data);
};

export const validateProductImport = (data: unknown) => {
  return ProductImportSchema.safeParse(data);
};

// Custom Validators
export const isValidPrice = (price: number): boolean => {
  return price >= 0 && Number.isFinite(price);
};

export const isValidStock = (stock: number): boolean => {
  return Number.isInteger(stock) && stock >= 0;
};

export const isValidDiscount = (
  discount: { type: string; value: number; startDate?: Date; endDate?: Date }
): boolean => {
  if (!['none', 'percentage', 'fixed'].includes(discount.type)) return false;
  if (discount.value < 0) return false;
  if (discount.type === 'percentage' && discount.value > 100) return false;
  if (discount.startDate && discount.endDate && discount.startDate > discount.endDate) return false;
  return true;
};

// Validation Error Messages
export const ValidationErrors = async () => {
  const t = await getTranslations('product.validation');
  return {
    INVALID_PRICE: t('invalid_price'),
    INVALID_STOCK: t('invalid_stock'),
    INVALID_DISCOUNT: t('invalid_discount'),
    MISSING_WAREHOUSE: t('warehouse_min'),
    INVALID_IMAGES: t('images_min'),
    INVALID_SIZES: t('invalid_sizes'),
    INVALID_COLORS: t('invalid_colors'),
    MISSING_SOURCE: t('source_required'),
    MISSING_SOURCE_ID: t('source_id_required'),
    MISSING_SOURCE_STORE_ID: t('source_store_id_required'),
  };
};

// Export all
export default {
  ProductInputSchema,
  ProductUpdateSchema,
  ProductImportSchema,
  validateProductData,
  validateProductUpdate,
  validatePricing,
  validateInventory,
  validateProductImport,
  isValidPrice,
  isValidStock,
  isValidDiscount,
  ValidationErrors,
};