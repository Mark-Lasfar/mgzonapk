import { z } from 'zod'

// Color and Size Schema
export const ColorSizeSchema = z.object({
  name: z.string().min(1, 'Size name is required'),
  quantity: z.number().min(0),
  inStock: z.boolean().default(true),
})

export const ColorSchema = z.object({
  name: z.string().min(1, 'Color name is required'),
  hex: z.string().regex(/^#([0-9A-Fa-f]{3}){1,2}$/, 'Invalid hex color'),
  quantity: z.number().min(0),
  inStock: z.boolean().default(true),
  sizes: z.array(ColorSizeSchema).optional(),
})

// Base Warehouse Schema
export const WarehouseBaseSchema = z.object({
  provider: z.enum(['ShipBob', '4PX', 'amazon', 'aliexpress', 'shopify']),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().min(0),
  location: z.string(),
  minimumStock: z.number().min(0).default(5),
  reorderPoint: z.number().min(0).default(10),
  colors: z.array(ColorSchema).optional(),
  lastUpdated: z.date().optional(),
  updatedBy: z.string().optional(),
})

// Warehouse Input Schema
export const WarehouseInputSchema = WarehouseBaseSchema.extend({
  name: z.string().min(1, 'Warehouse name is required'),
  code: z.string().min(1, 'Warehouse code is required'),
  apiKey: z.string().min(1, 'API key is required'),
  apiUrl: z.string().url('Invalid API URL'),
  isActive: z.boolean().default(true),
})

// Warehouse Stock Schema
export const WarehouseStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  sku: z.string().min(1, 'SKU is required'),
  quantity: z.number().min(0),
  location: z.string().optional(),
  minimumStock: z.number().min(0).default(5),
  reorderPoint: z.number().min(0).default(10),
  colors: z.array(ColorSchema).optional(),
  lastUpdated: z.date(),
  updatedBy: z.string(),
})

// Warehouse Data Schema for Products
export const WarehouseDataSchema = z.array(
  WarehouseBaseSchema.extend({
    colors: z.array(ColorSchema).optional(),
  })
).min(1, 'At least one warehouse is required')

export type WarehouseInput = z.infer<typeof WarehouseInputSchema>
export type WarehouseStock = z.infer<typeof WarehouseStockSchema>
export type WarehouseData = z.infer<typeof WarehouseDataSchema>