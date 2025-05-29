'use server'

import { connectToDatabase } from '@/lib/db'
import Product, { IProduct } from '@/lib/db/models/product.model'
import { revalidatePath } from 'next/cache'
import { formatError } from '../utils'
// import { ProductUpdateSchema } from '../validator'
import { IProductInput } from '@/types'
import { auth } from '@/auth'
import { getSetting } from './setting.actions'
import mongoose from 'mongoose'
import { updateSellerMetrics,getSellerByUserId } from './seller.actions'
import { updateWarehouseStock } from './warehouse.actions'
import { z } from 'zod'
// import { ProductInputSchema } from '../validator/product.validator'
// import { ShipBobService } from '../api/integrations/shipbob/service'
// import { ShipBobSehrvice } from '../services/warehouse/shipbob'



import { ProductInputSchema, ProductUpdateSchema } from '../validator/product.validator'
import { WarehouseProvider } from '../services/warehouse/types'
import { ShipBobService } from '../services/warehouse/shipbob'
import { FourPXService } from '../services/warehouse/fourpx'
// import { AmazonFulfillmentService } from '../api/integrations/amazon/service'
// import { AliExpressFulfillmentService } from '../api/integrations/aliexpress/service'
// import { AmazonFulfillmentService } from '../api/integrations/amazon/service'

// // Warehouse providers configuration
// const warehouseProviders: { [key: string]: WarehouseProvider } = {
//   ShipBob: new ShipBobService({
//     apiKey: process.env.SHIPBOB_API_KEY!,
//     apiUrl: process.env.SHIPBOB_API_URL!,
//   }),
//   '4PX': new FourPXService({
//     apiKey: process.env.FOURPX_API_KEY!,
//     apiUrl: process.env.FOURPX_API_URL!,
//   }),
// }





const warehouseProviders = {
  ShipBob: new ShipBobService({
    apiKey: process.env.SHIPBOB_API_KEY!,
    apiUrl: process.env.SHIPBOB_API_URL!,
  }),
  '4PX': new FourPXService({
    apiKey: process.env.FOURPX_API_KEY!,
    apiUrl: process.env.FOURPX_API_URL!,
  }),

}


// Types
type ProductSortOption =
  | 'latest'
  | 'best-selling'
  | 'price-low-to-high'
  | 'price-high-to-low'
  | 'avg-customer-review'

interface ProductQueryFilters {
  search?: string
  category?: string
  tag?: string
  minPrice?: number
  maxPrice?: number
  rating?: number
  status?: 'active' | 'draft' | 'pending' | 'rejected'
  stock?: number
}

interface ProductListResponse {
  products: IProduct[]
  totalPages: number
  totalProducts: number
  from: number
  to: number
}

// Helper Functions
async function getCurrentUserInfo() {
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return {
    userId: session.user.id,
    userName: session.user.name || session.user.id,
    userRole: session.user.role || 'USER'
  }
}

async function logOperation(operation: string, details: any) {
  const { userName } = await getCurrentUserInfo()
  console.log(`[${new Date().toISOString()}] 📝 ${operation}:`, {
    user: userName,
    ...details
  })
}
// import { updateWarehouseStock, updateSellerMetrics } from '@/lib/operations'

// async function validateSeller(userId: string) {
//   const sellerResponse = await getSellerByUserId(userId)
//   if (!sellerResponse.success || !sellerResponse.data) {
//     throw new Error('Seller account required')
//   }
//   return sellerResponse.data
// }

// -------------------------
// First version of createProduct (example snippet fixing static values)
// -------------------------
// export async function createProduct_v1(data: IProductInput) {
//   const session = await mongoose.startSession()
//   session.startTransaction()

//   try {
//     // Use current time and current user info dynamically
//     const creationTime = new Date()
//     const { userId, userName } = await getCurrentUserInfo()

//     await connectToDatabase()

//     const seller = await validateSeller(userId)
    
//     console.log(`[${creationTime.toISOString()}] Creating product:`, {
//       name: data.name,
//       seller: seller.businessName
//     })

//     // Validate and process colors and sizes
//     const processedWarehouseData = data.warehouseData.map(warehouse => {
//       const totalQuantity = warehouse.colors.reduce((total, color) => {
//         const colorTotal = color.sizes.reduce((sum, size) => sum + size.quantity, 0)
//         color.quantity = colorTotal // Update color total
//         color.inStock = colorTotal > 0 // Update color stock status
//         return total + colorTotal
//       }, 0)

//       return {
//         ...warehouse,
//         quantity: totalQuantity // Update warehouse total
//       }
//     })

//     // Calculate total stock across all warehouses
//     const totalStock = processedWarehouseData.reduce(
//       (sum, warehouse) => sum + warehouse.quantity,
//       0
//     )

//     // Prepare product data
//     const productData = {
//       ...data,
//       name: data.name.trim(),
//       slug: data.slug.trim(),
//       category: data.category.trim(),
//       brand: data.brand.trim(),
//       description: data.description.trim(),
//       price: Number(data.price),
//       listPrice: Number(data.listPrice) || Number(data.price),
//       countInStock: totalStock,
//       warehouseData: processedWarehouseData,
//       colors: processedWarehouseData.reduce((allColors: any[], warehouse) => {
//         warehouse.colors.forEach(warehouseColor => {
//           const existingColor = allColors.find(c => c.name === warehouseColor.name)
//           if (existingColor) {
//             // Combine quantities for same color across warehouses
//             existingColor.quantity += warehouseColor.quantity
//             existingColor.inStock = existingColor.quantity > 0
//             // Combine sizes
//             warehouseColor.sizes.forEach(warehouseSize => {
//               const existingSize = existingColor.sizes.find(s => s.name === warehouseSize.name)
//               if (existingSize) {
//                 existingSize.quantity += warehouseSize.quantity
//                 existingSize.inStock = existingSize.quantity > 0
//               } else {
//                 existingColor.sizes.push({ ...warehouseSize })
//               }
//             })
//           } else {
//             // Add new color with its sizes
//             allColors.push({
//               ...warehouseColor,
//               sizes: [...warehouseColor.sizes]
//             })
//           }
//         })
//         return allColors
//       }, []),
//       sizes: ['S', 'M', 'L', 'XL', 'XXL'],
//       isPublished: data.isPublished || false,
//       sellerId: seller._id,
//       seller: {
//         name: seller.businessName,
//         email: seller.email,
//         subscription: seller.subscription.plan
//       },
//       status: data.isPublished ? 'pending' : 'draft',
//       createdAt: creationTime,
//       updatedAt: creationTime,
//       createdBy: userName,
//       updatedBy: userName
//     }

//     // Create product
//     const product = await Product.create([productData], { session })
//     const createdProduct = product[0]

//     // Update warehouse stock
//     await Promise.all(processedWarehouseData.map(warehouse =>
//       updateWarehouseStock({
//         productId: createdProduct._id,
//         warehouseId: warehouse.warehouseId,
//         quantity: warehouse.quantity,
//         sku: warehouse.sku,
//         location: warehouse.location,
//         minimumStock: warehouse.minimumStock,
//         reorderPoint: warehouse.reorderPoint,
//         colors: warehouse.colors,
//         updatedBy: userName
//       })
//     ))

//     // Update seller metrics
//     await updateSellerMetrics(seller._id, {
//       productsCount: '+1',
//       lastProductCreated: creationTime
//     })

//     await session.commitTransaction()

//     // Revalidate paths
//     revalidatePath('/seller/dashboard/products')
//     revalidatePath('/admin/products')

//     console.log(`[${creationTime.toISOString()}] Product created successfully:`, {
//       productId: createdProduct._id,
//       name: createdProduct.name,
//       totalStock,
//       colorsCount: createdProduct.colors.length
//     })

//     return {
//       success: true,
//       message: 'Product created successfully',
//       data: createdProduct
//     }
//   } catch (error) {
//     await session.abortTransaction()
//     console.error('Product creation error:', error)
//     // Additional error handling can be added here
//     return { 
//       success: false, 
//       message: error instanceof Error ? error.message : 'Failed to create product' 
//     }
//   } finally {
//     session.endSession()
//   }
// }

// -------------------------
// Second version with all functions below
// -------------------------

// GET ALL PRODUCTS FOR ADMIN
export async function getAllProductsForAdmin({
  query = '',
  page = 1,
  sort = 'latest',
  limit,
}: {
  query?: string
  page?: number
  sort?: string
  limit?: number
}): Promise<ProductListResponse> {
  try {
    await connectToDatabase()

    const {
      common: { pageSize },
    } = await getSetting()
    limit = limit || pageSize

    const queryFilter: any = {}
    if (query && query !== 'all') {
      queryFilter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { slug: { $regex: query, $options: 'i' } },
      ]
    }

    const sortOptions: Record<string, 1 | -1> =
      sort === 'best-selling'
        ? { numSales: -1 }
        : sort === 'price-low-to-high'
        ? { price: 1 }
        : sort === 'price-high-to-low'
        ? { price: -1 }
        : sort === 'avg-customer-review'
        ? { avgRating: -1 }
        : { updatedAt: -1 } // Default: latest

    const skip = (page - 1) * limit

    const [products, totalProducts] = await Promise.all([
      Product.find(queryFilter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .select({
          name: 1,
          slug: 1,
          price: 1,
          category: 1,
          countInStock: 1,
          isPublished: 1,
          avgRating: 1,
          updatedAt: 1,
          pricing: 1,
          metrics: 1,
          status: 1,
          warehouseData: 1
        })
        .lean(),
      Product.countDocuments(queryFilter),
    ])

    const formattedProducts = products.map(product => ({
      ...product,
      metrics: {
        ...product.metrics,
        rating: product.metrics?.rating || 0,
      },
    }))

    await logOperation('Admin Products List Retrieved', {
      total: totalProducts,
      page,
      limit,
      sort,
    })

    return {
      products: JSON.parse(JSON.stringify(formattedProducts)),
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      from: skip + 1,
      to: skip + products.length,
    }
  } catch (error) {
    console.error('Error in getAllProductsForAdmin:', error)
    return {
      products: [],
      totalPages: 0,
      totalProducts: 0,
      from: 0,
      to: 0,
    }
  }
}

// CREATE PRODUCT (Second version)
// CREATE PRODUCT
async function validateSeller(userId: string) {
  const sellerResponse = await getSellerByUserId(userId)
  if (!sellerResponse.success || !sellerResponse.data) {
    throw new Error('Seller account required')
  }
  return sellerResponse.data
}

export async function createProduct(data: IProductInput) {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Get current user info and validate authorization
    const authSession = await auth()
    if (!authSession?.user) {
      throw new Error('Unauthorized')
    }

    const currentUser = {
      id: authSession.user.id,
      name: authSession.user.name || authSession.user.email,
      role: authSession.user.role
    }

    if (currentUser.role !== 'seller' && currentUser.role !== 'Admin') {
      throw new Error('Only sellers and admins can create products')
    }

    const creationTime = new Date()
    await connectToDatabase()

    // Validate seller and get seller info
    const seller = await validateSeller(currentUser.id)
    
    console.log(`[${creationTime.toISOString()}] Creating product:`, {
      name: data.name,
      seller: seller.businessName
    })

    // Validate input data
    const validatedData = ProductInputSchema.parse(data)

    // Check for duplicate slug
    const existingProduct = await Product.findOne({ slug: validatedData.slug }).session(session)
    if (existingProduct) {
      throw new Error('This slug already exists. Please choose a different one.')
    }

    // Process warehouse data and calculate total stock
    const processedWarehouseData = validatedData.warehouseData?.map(warehouse => {
      const totalQuantity = warehouse.colors.reduce((total, color) => {
        const colorTotal = color.sizes.reduce((sum, size) => sum + size.quantity, 0)
        color.quantity = colorTotal
        color.inStock = colorTotal > 0
        return total + colorTotal
      }, 0)

      return {
        ...warehouse,
        quantity: totalQuantity,
        lastUpdated: creationTime,
        updatedBy: currentUser.name
      }
    }) || []

    const totalStock = processedWarehouseData.reduce((sum, warehouse) => sum + warehouse.quantity, 0)

    // Combine colors from all warehouses
    const combinedColors = processedWarehouseData.reduce((allColors: any[], warehouse) => {
      warehouse.colors.forEach(warehouseColor => {
        const existingColor = allColors.find(c => c.name === warehouseColor.name)
        if (existingColor) {
          existingColor.quantity += warehouseColor.quantity
          existingColor.inStock = existingColor.quantity > 0

          warehouseColor.sizes.forEach(warehouseSize => {
            const existingSize = existingColor.sizes.find(s => s.name === warehouseSize.name)
            if (existingSize) {
              existingSize.quantity += warehouseSize.quantity
              existingSize.inStock = existingSize.quantity > 0
            } else {
              existingColor.sizes.push({ ...warehouseSize })
            }
          })
        } else {
          allColors.push({
            ...warehouseColor,
            sizes: [...warehouseColor.sizes]
          })
        }
      })
      return allColors
    }, [])

    // Calculate pricing
    const basePrice = Number(validatedData.price)
    const markup = Number(validatedData.pricing?.markup || 30)
    const commission = seller.subscription.features?.commission || 3
    const markupAmount = basePrice * (markup / 100)
    const commissionAmount = basePrice * (commission / 100)

    // Prepare product data
    const productData = {
      ...validatedData,
      name: validatedData.name.trim(),
      slug: validatedData.slug.trim(),
      category: validatedData.category.trim(),
      brand: validatedData.brand.trim(),
      description: validatedData.description.trim(),
      price: basePrice,
      listPrice: Number(validatedData.listPrice) || basePrice,
      countInStock: totalStock,
      warehouseData: processedWarehouseData,
      colors: combinedColors,
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      isPublished: validatedData.isPublished || false,
      sellerId: seller._id,
      seller: {
        name: seller.businessName,
        email: seller.email,
        subscription: seller.subscription.plan
      },
      pricing: {
        basePrice,
        markup,
        profit: markupAmount - commissionAmount,
        commission: commissionAmount,
        finalPrice: basePrice + markupAmount,
        discount: validatedData.pricing?.discount
      },
      metrics: {
        views: 0,
        sales: 0,
        revenue: 0,
        returns: 0,
        rating: 0
      },
      status: validatedData.isPublished ? 'pending' : 'draft',
      createdBy: currentUser.name,
      updatedBy: currentUser.name,
      createdAt: creationTime,
      updatedAt: creationTime
    }

    // Create product
    const product = await Product.create([productData], { session })
    const createdProduct = product[0]

    // Update warehouse stock
    await Promise.all(processedWarehouseData.map(warehouse =>
      updateWarehouseStock({
        productId: createdProduct._id,
        warehouseId: warehouse.warehouseId,
        quantity: warehouse.quantity,
        sku: warehouse.sku,
        location: warehouse.location,
        minimumStock: warehouse.minimumStock,
        reorderPoint: warehouse.reorderPoint,
        colors: warehouse.colors,
        updatedBy: currentUser.name
      })
    ))

    // Update seller metrics
    await updateSellerMetrics(seller._id, {
      productsCount: '+1',
      lastProductCreated: creationTime
    })

    await session.commitTransaction()

    // Revalidate paths
    revalidatePath('/seller/dashboard/products')
    revalidatePath('/admin/products')
    revalidatePath(`/product/${createdProduct.slug}`)

    console.log(`[${creationTime.toISOString()}] Product created successfully:`, {
      productId: createdProduct._id,
      name: createdProduct.name,
      totalStock,
      colorsCount: createdProduct.colors.length
    })

    return {
      success: true,
      message: 'Product created successfully',
      data: createdProduct
    }

  } catch (error) {
    await session.abortTransaction()
    console.error('Product creation error:', error)

    if (error instanceof Error) {
      if (error.message.includes('duplicate')) {
        return { 
          success: false, 
          message: 'This slug already exists. Please choose a different one.' 
        }
      }
      if (error.message.includes('validation failed')) {
        return { 
          success: false, 
          message: 'Please check that all required fields are filled correctly.' 
        }
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create product'
    }

  } finally {
    session.endSession()
  }
}

// UPDATE PRODUCT
export async function updateProduct(data: z.infer<typeof ProductUpdateSchema>) {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Validate input data first
    const validatedInput = ProductUpdateSchema.parse(data)

    // Check authentication
    const authSession = await auth()
    if (!authSession?.user) {
      throw new Error('Unauthorized')
    }

    await connectToDatabase()

    // Verify product existence and ownership
    const existingProduct = await Product.findById(validatedInput._id).session(session)
    if (!existingProduct) {
      throw new Error('Product not found')
    }

    // Check authorization
    if (
      authSession.user.role !== 'Admin' &&
      existingProduct.sellerId.toString() !== authSession.user.id
    ) {
      throw new Error('Unauthorized')
    }

    // Get seller information
    const sellerResponse = await getSellerByUserId(
      authSession.user.role === 'Admin'
        ? existingProduct.sellerId.toString()
        : authSession.user.id
    )

    if (!sellerResponse.success || !sellerResponse.data) {
      throw new Error('Seller not found')
    }

    const seller = sellerResponse.data

    // Calculate pricing if price or markup changed
    let pricing = existingProduct.pricing
    if (
      validatedInput.price !== existingProduct.price || 
      validatedInput.pricing?.markup !== existingProduct.pricing.markup
    ) {
      const basePrice = validatedInput.price
      const markup = validatedInput.pricing?.markup || existingProduct.pricing.markup
      const commission = seller.subscription.features.commission || 3
      const markupAmount = basePrice * (markup / 100)
      const commissionAmount = basePrice * (commission / 100)

      pricing = {
        basePrice,
        markup,
        profit: markupAmount - commissionAmount,
        commission: commissionAmount,
        finalPrice: basePrice + markupAmount
      }
    }

    // Check if stock status has changed
    const isStockStatusChanged =
      (existingProduct.stock > 0 && validatedInput.stock === 0) ||
      (existingProduct.stock === 0 && validatedInput.stock > 0)

    // Prepare update data
    const updateData = {
      ...validatedInput,
      pricing,
      status: validatedInput.isPublished
        ? existingProduct.status === 'active'
          ? 'active'
          : 'pending'
        : 'draft',
      updatedAt: new Date(),
      updatedBy: authSession.user.name || authSession.user.email
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      validatedInput._id,
      updateData,
      { new: true, session }
    )

    // Update seller metrics if stock status changed
    if (isStockStatusChanged) {
      await updateSellerMetrics(seller._id, {
        action: validatedInput.stock === 0 
          ? 'product_out_of_stock' 
          : 'product_back_in_stock'
      })
    }

    // Commit transaction
    await session.commitTransaction()

    // Revalidate cache paths
    revalidatePath('/seller/dashboard/products')
    revalidatePath('/admin/products')
    revalidatePath(`/product/${updatedProduct?.slug}`)

    // Log the update operation
    await logOperation('Product Updated', {
      productId: updatedProduct?._id,
      name: updatedProduct?.name,
      seller: seller.businessName
    })

    return {
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    }

  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction()
    
    console.error('Product update error:', error)
    return { 
      success: false, 
      message: formatError(error)
    }

  } finally {
    // Always end the session
    session.endSession()
  }
}

// DELETE PRODUCT
export async function deleteProduct(id: string) {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // التحقق من المصادقة
    const authSession = await auth()
    if (!authSession?.user) {
      throw new Error('Unauthorized')
    }

    await connectToDatabase()

    // البحث عن المنتج مع استخدام الجلسة
    const product = await Product.findById(id).session(session)
    if (!product) {
      throw new Error('Product not found')
    }

    // التحقق من الصلاحيات
    if (
      authSession.user.role !== 'Admin' &&
      product.sellerId.toString() !== authSession.user.id
    ) {
      throw new Error('Unauthorized')
    }

    // حذف المنتج
    await Product.findByIdAndDelete(id).session(session)

    // تحديث إحصائيات البائع
    if (product.sellerId) {
      await updateSellerMetrics(product.sellerId, {
        productsCount: '-1',
        lastUpdated: new Date()
      })
    }

    // تسجيل عملية الحذف
    await logOperation('Product Deleted', {
      productId: id,
      name: product.name,
      deletedBy: authSession.user.name || authSession.user.email,
      timestamp: new Date()
    })

    // تأكيد المعاملة
    await session.commitTransaction()

    // تحديث الصفحات ذات الصلة
    revalidatePath('/seller/dashboard/products')
    revalidatePath('/admin/products')
    revalidatePath(`/product/${product.slug}`)

    return {
      success: true,
      message: 'Product deleted successfully',
      metadata: {
        deletedAt: new Date(),
        deletedBy: authSession.user.name || authSession.user.email,
        productId: id
      }
    }

  } catch (error) {
    // التراجع عن المعاملة في حالة حدوث خطأ
    await session.abortTransaction()
    
    console.error('Delete product error:', {
      error,
      productId: id,
      userId: authSession?.user?.id,
      timestamp: new Date()
    })

    // إرجاع رسالة خطأ مناسبة
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return {
          success: false,
          message: 'You do not have permission to delete this product',
          code: 'UNAUTHORIZED'
        }
      }
      if (error.message.includes('Product not found')) {
        return {
          success: false,
          message: 'The product you are trying to delete does not exist',
          code: 'NOT_FOUND'
        }
      }
    }

    return { 
      success: false, 
      message: formatError(error),
      code: 'INTERNAL_ERROR'
    }

  } finally {
    // إنهاء الجلسة دائماً
    session.endSession()
  }
}

// REVIEW PRODUCT (Admin only)
export async function reviewProduct(
  productId: string,
  approved: boolean,
  notes?: string
) {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const authSession = await auth()
    if (!authSession?.user?.role === 'Admin') {
      throw new Error('Unauthorized')
    }

    await connectToDatabase()

    const product = await Product.findById(productId).session(session)
    if (!product) {
      throw new Error('Product not found')
    }

    // Update product status
    const updateData = {
      status: approved ? 'active' : 'rejected',
      adminReview: {
        approved,
        reviewedAt: new Date(),
        reviewedBy: authSession.user.id,
        notes: notes || ''
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, session }
    )

    await session.commitTransaction()

    revalidatePath('/admin/products')
    revalidatePath('/seller/dashboard/products')
    if (approved) {
      revalidatePath(`/product/${product.slug}`)
    }

    return {
      success: true,
      message: `Product ${approved ? 'approved' : 'rejected'} successfully`,
      data: updatedProduct
    }
  } catch (error) {
    await session.abortTransaction()
    return { success: false, message: formatError(error) }
  } finally {
    session.endSession()
  }
}

// GET PRODUCT CATEGORIES
export async function getProductCategories(limit = 4) {
  try {
    await connectToDatabase()

    const categories = await Product.aggregate([
      {
        $match: {
          isPublished: true,
          status: 'active',
          stock: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          totalSales: { $sum: '$metrics.sales' },
          image: { $first: '$images' },
          latestProduct: {
            $first: {
              name: '$name',
              slug: '$slug',
              images: '$images'
            }
          }
        }
      },
      {
        $sort: {
          productCount: -1,
          totalSales: -1
        }
      },
      {
        $limit: limit
      },
      {
        $project: {
          name: '$_id',
          image: { $first: '$latestProduct.images' },
          slug: '$latestProduct.slug',
          productCount: 1
        }
      }
    ])

    return JSON.parse(JSON.stringify(categories))
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}

// GET PRODUCTS FOR CARD
export async function getProductsForCard({
  tag,
  limit = 4,
}: {
  tag: string
  limit?: number
}): Promise<{
  name: string
  slug: string
  images: string[]
  price: number
  metrics: any
  href?: string
  image?: string
}[]> {
  try {
    await connectToDatabase()

    const products = await Product.aggregate([
      {
        $match: {
          tags: { $in: [tag] },
          isPublished: true,
          status: 'active',
          stock: { $gt: 0 },
        },
      },
      {
        $addFields: {
          href: { $concat: ['/product/', '$slug'] },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $project: {
          name: 1,
          slug: 1,
          images: 1,
          price: 1,
          metrics: 1,
          href: 1,
          image: 1,
        },
      },
      { $sort: { 'metrics.sales': -1, createdAt: -1 } },
      { $limit: limit },
    ])

    return JSON.parse(JSON.stringify(products))
  } catch (error) {
    console.error('Error fetching products for card:', error)
    return []
  }
}


// GET PRODUCTS BY TAG
export async function getProductsByTag({
  tag,
  limit = 10,
  sortBy = 'sales', // sales or createdAt
}: {
  tag: string
  limit?: number
  sortBy?: 'sales' | 'createdAt'
}) {
  try {
    await connectToDatabase()

    const query: any = {
      tags: { $in: [tag] },
      isPublished: true,
    }

    // إذا اخترنا الفرز حسب المبيعات، نضيف شروط إضافية
    if (sortBy === 'sales') {
      query.status = 'active'
      query.stock = { $gt: 0 }
    }

    const sortOption =
      sortBy === 'sales' ? { 'metrics.sales': -1 } : { createdAt: -1 }

    const products = await Product.find(query)
      .sort(sortOption)
      .limit(limit)
      .lean()

    return JSON.parse(JSON.stringify(products))
  } catch (error) {
    console.error('Error fetching products by tag:', error)
    return []
  }
}


// GET LATEST PRODUCTS
export async function getLatestProducts({
  limit = 4,
}: { limit?: number } = {}) {
  try {
    await connectToDatabase()

    const products = await Product.find({
      isPublished: true,
      status: 'active',
      stock: { $gt: 0 }
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('name images slug price')
      .lean()

    return JSON.parse(JSON.stringify(products))
  } catch (error) {
    console.error('Error fetching latest products:', error)
    return []
  }
}

// GET ALL PRODUCTS
export async function getAllProducts({
  query = '',
  category = 'all',
  tag = 'all',
  sort = 'latest',
  page = 1,
  limit,
  price,
  rating,
}: {
  query?: string
  category?: string
  tag?: string
  sort?: ProductSortOption | string
  page?: number
  limit?: number
  price?: string
  rating?: string
}): Promise<ProductListResponse> {
  try {
    await connectToDatabase()

    const {
      common: { pageSize },
    } = await getSetting()
    limit = limit || pageSize

    // البناء الذكي للفلترات مع دمج الشروط
    const queryFilter: any = {
      isPublished: true,
      status: 'active',
      stock: { $gt: 0 },
    }

    if (query && query !== 'all') {
      queryFilter.name = { $regex: query, $options: 'i' }
    }

    if (category && category !== 'all') {
      queryFilter.category = category
    }

    if (tag && tag !== 'all') {
      queryFilter.tags = tag
    }

    if (rating && rating !== 'all') {
      queryFilter['metrics.rating'] = { $gte: Number(rating) }
    }

    if (price && price !== 'all') {
      const [min, max] = price.split('-').map(Number)
      queryFilter['pricing.finalPrice'] = {
        $gte: min,
        $lte: max,
      }
    }

    // ترتيب النتائج حسب الخيار
    const order: Record<string, 1 | -1> =
      sort === 'best-selling'
        ? { 'metrics.sales': -1 }
        : sort === 'price-low-to-high'
        ? { 'pricing.finalPrice': 1 }
        : sort === 'price-high-to-low'
        ? { 'pricing.finalPrice': -1 }
        : sort === 'avg-customer-review'
        ? { 'metrics.rating': -1 }
        : { createdAt: -1 }

    // حساب التخطي والحد للصفحة
    const skip = limit * (Number(page) - 1)

    // تنفيذ الاستعلام والعد بالتوازي
    const [products, totalProducts] = await Promise.all([
      Product.find(queryFilter)
        .sort(order)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(queryFilter),
    ])

    return {
      products: JSON.parse(JSON.stringify(products)) as IProduct[],
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      from: skip + 1,
      to: skip + products.length,
    }
  } catch (error) {
    console.error('Error fetching products:', error)
    return {
      products: [],
      totalPages: 0,
      totalProducts: 0,
      from: 0,
      to: 0,
    }
  }
}




// GET PRODUCT BY ID
export async function getProductById(productId: string) {
  try {
    // التحقق من صحة معرف المنتج
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      throw new Error('Invalid product ID')
    }

    // الاتصال بقاعدة البيانات
    await connectToDatabase()

    // البحث عن المنتج مع استخدام lean() للأداء الأفضل
    const product = await Product.findById(productId)
      .lean()
      .select('-__v') // استبعاد حقل __v
      .exec()

    if (!product) {
      throw new Error('Product not found')
    }

    // تحويل التاريخ إلى التنسيق المطلوب
    const formattedProduct = {
      ...product,
      createdAt: product.createdAt 
        ? new Date(product.createdAt).toISOString()
        : undefined,
      updatedAt: product.updatedAt
        ? new Date(product.updatedAt).toISOString()
        : undefined
    }

    // تسجيل الوصول للمنتج (يمكن استخدامه للتحليلات)
    console.info('Product accessed:', {
      productId,
      timestamp: new Date().toISOString(),
      accessedBy: 'Nigel-Henry' // using the current user
    })

    // تحويل البيانات إلى JSON وإرجاعها
    return {
      success: true,
      data: JSON.parse(JSON.stringify(formattedProduct)) as IProduct,
      metadata: {
        accessed: new Date().toISOString(),
        by: 'Nigel-Henry'
      }
    }

  } catch (error) {
    // معالجة الأخطاء بشكل مناسب
    console.error('Error fetching product:', {
      productId,
      error,
      timestamp: new Date().toISOString()
    })

    if (error instanceof Error) {
      if (error.message.includes('Invalid product ID')) {
        return {
          success: false,
          message: 'Please provide a valid product ID',
          code: 'INVALID_ID'
        }
      }
      if (error.message.includes('Product not found')) {
        return {
          success: false,
          message: 'The requested product does not exist',
          code: 'NOT_FOUND'
        }
      }
    }

    return {
      success: false,
      message: formatError(error),
      code: 'INTERNAL_ERROR',
      metadata: {
        timestamp: new Date().toISOString(),
        requestedId: productId
      }
    }
  }
}

// GET PRODUCT BY SLUG
export async function getProductBySlug(slug: string) {
  try {
    await connectToDatabase()
    const product = await Product.findOne({
      slug,
      isPublished: true,
      status: 'active',
    }).lean()

    if (!product) throw new Error('Product not found')

    return JSON.parse(JSON.stringify(product)) as IProduct
  } catch (error) {
    throw new Error(formatError(error))
  }
}



// GET RELATED PRODUCTS
export async function getRelatedProducts({
  category,
  productId,
  limit = 4,
}: {
  category: string
  productId: string
  limit?: number
}) {
  try {
    await connectToDatabase()

    const products = await Product.find({
      _id: { $ne: productId },
      category,
      isPublished: true,
      status: 'active',
      stock: { $gt: 0 }
    })
      .sort({ 'metrics.sales': -1 })
      .limit(limit)
      .select('name images slug price')
      .lean()

    return JSON.parse(JSON.stringify(products))
  } catch (error) {
    console.error('Error fetching related products:', error)
    return []
  }
}

// GET ALL TAGS
export async function getAllTags() {
  try {
    await connectToDatabase()

    const tags = await Product.aggregate([
      {
        $match: {
          isPublished: true,
          status: 'active',
        },
      },
      { $unwind: '$tags' },
      { $group: { _id: null, uniqueTags: { $addToSet: '$tags' } } },
      { $project: { _id: 0, uniqueTags: 1 } },
    ])

    return (
      tags[0]?.uniqueTags
        .sort((a: string, b: string) => a.localeCompare(b))
        .map((tag: string) =>
          tag
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
        ) || []
    )
  } catch (error) {
    console.error('Error fetching tags:', error)
    return []
  }
}


export async function getRelatedProductsByCategory({
  category,
  productId,
  limit = 4,
  page = 1,
}: {
  category: string
  productId: string
  limit?: number
  page: number
}): Promise<{ data: IProduct[]; totalPages: number }> {
  try {
    const {
      common: { pageSize },
    } = await getSetting()

    limit = limit || pageSize
    await connectToDatabase()

    const skipAmount = (Number(page) - 1) * limit
    const conditions = {
      isPublished: true,
      category,
      _id: { $ne: productId },
    }

    const products = await Product.find(conditions)
      .sort({ numSales: -1 }) // ترتيب تنازلي حسب المبيعات
      .skip(skipAmount)
      .limit(limit)
      .lean()

    const productsCount = await Product.countDocuments(conditions)

    return {
      data: JSON.parse(JSON.stringify(products)) as IProduct[],
      totalPages: Math.ceil(productsCount / limit),
    }
  } catch (error) {
    console.error('Error fetching related products:', error)
    return { data: [], totalPages: 0 }
  }
}


// GET ALL CATEGORIES
export async function getAllCategories(): Promise<string[]> {
  try {
    // Connect to the database
    await connectToDatabase()

    // Fetch distinct categories for active, published products
    const categories = await Product.find({
      isPublished: true,
      status: 'active',
    }).distinct('category')

    return categories
  } catch (error) {
    console.error('Error fetching categories:', error)
    return []
  }
}



// GET ALL PRODUCTS FOR A SPECIFIC SELLER
export async function getSellerProducts({
  sellerId,
  query = '',
  page = 1,
  limit = 10,
}: {
  sellerId: string
  query?: string
  page?: number
  limit?: number
}): Promise<ProductListResponse> {
  try {
    await connectToDatabase()

    const queryFilter: any = { sellerId }
    if (query) {
      queryFilter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { category: { $regex: query, $options: 'i' } },
        { brand: { $regex: query, $options: 'i' } },
        { slug: { $regex: query, $options: 'i' } }
      ]
    }

    const skip = (page - 1) * limit

    const [products, totalProducts] = await Promise.all([
      Product.find(queryFilter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({
          name: 1,
          slug: 1,
          price: 1,
          category: 1,
          countInStock: 1,
          isPublished: 1,
          avgRating: 1,
          updatedAt: 1,
          pricing: 1,
          metrics: 1,
          status: 1,
          warehouseData: 1
        })
        .lean(),
      Product.countDocuments(queryFilter)
    ])

    const formattedProducts = products.map(product => ({
      ...product,
      metrics: {
        ...product.metrics,
        rating: product.metrics?.rating || 0
      }
    }))

    await logOperation('Seller Products List Retrieved', {
      sellerId,
      total: totalProducts,
      page,
      limit
    })

    return {
      products: JSON.parse(JSON.stringify(formattedProducts)),
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      from: skip + 1,
      to: skip + products.length,
    }
  } catch (error) {
    console.error('Error in getSellerProducts:', error)
    return {
      products: [],
      totalPages: 0,
      totalProducts: 0,
      from: 0,
      to: 0,
    }
  }
}
