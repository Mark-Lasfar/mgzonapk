'use server'

// import { ShipBobService } from "../api/integrations/shipbob/service"
// import { WarehouseProvider } from "../api/types"
// import { ShipBobService } from "../services/warehouse/shipbob"
import { ProductInputSchema, ProductUpdateSchema } from '@/lib/validator/product.validator';
// import { connectToDatabase } from '@/lib/db'
import Product, { IProduct } from '@/lib/db/models/product.model'
import Seller from '@/lib/db/models/seller.model'
import { revalidatePath } from 'next/cache'
// import { formatError } from '../utils'
import { auth } from '@/auth'
// import { ProductImportService } from '@/lib/api/services/product-import';
import { getSetting } from './setting.actions'
// import mongoose from 'mongoose'
// import { updateSellerMetrics, getSellerByUserId } from './seller.actions'
// import { updateWarehouseStock } from './warehouse.actions'
// import { z } from 'zod'
// import { ProductInputSchema, ProductUpdateSchema } from '../validator/product.validator'
// import { WarehouseProvider } from '../services/warehouse/types'
// import { ShipBobService } from '../services/warehouse/shipbob'
// import { FourPXService } from '../services/warehouse/fourpx'
import { triggerWebhook } from './webhook.actions'
import { sendNotification } from '../utils/notification'
import { checkSubscription } from '../cron/subscription-check'
// import { Parser } from 'json2csv'
// import { ShipHeroService } from '../api/integrations/shiphero/service'

import { DynamicIntegrationService } from '@/lib/services/integrations';

// إعدادات مزودي المستودعات
// import { ShipBobService } from '@/lib/api/integrations/shipbob/service';
// import { WarehouseProvider } from '../api/types';
import { ShipHeroService } from '../api/integrations/shiphero/service';
// import { FourPXService } from '../services/warehouse/fourpx';
import { ShipBobService } from '../services/warehouse/shipbob';
// import { WarehouseProvider } from '../services/warehouse/types';
// import { WarehouseProvider } from '/types';
// import { connectToDatabase, getCurrentUserInfo, validateSeller, updateWarehouseStock, updateSellerMetrics, triggerWebhook, sendNotification, logOperation, revalidatePath } from '../utils';



import { z } from 'zod';
import { connectToDatabase } from '@/lib/db';
// import { ProductInputSchema, ProductUpdateSchema } from '@/lib/validator/product.validator';
// import { Product } from '@/lib/db/models';
// import { getSellerByUserId, updateSellerMetrics } from '@/lib/seller.actions';
// import { checkSubscription } from '@/lib/cron/subscription';
// import { sendNotification } from '@/lib/notification';
// import { triggerWebhook } from '@/lib/webhook';
// import { auth } from '@/lib/auth';
// import { revalidatePath } from 'pathify';
// import { ShipBobService } from '@/lib/services/shipbob';
// import { FourPXService } from '@/lib/services/fourpx';
// import { ShipHeroService } from '@/lib/services/shiphero';
// import { updateWarehouseStock } from '@/lib/warehouse.actions';
import mongoose from 'mongoose';
import { formatError } from '@/lib/utils';
import { ProductImportService } from '../api/services/product-import'
import { getSellerByUserId, updateSellerMetrics } from './seller.actions'
import { updateWarehouseStock } from './warehouse.actions';
import SellerIntegration from '../db/models/seller-integration.model';
// import { warehouseProviders } from '@/lib/warehouse';
// // import { IProduct } from '@/lib/models/product';

// const warehouseProviders: { [key: string]: WarehouseProvider } = {
//   ShipBob: new ShipBobService({
//     clientId: process.env.SHIPBOB_CLIENT_ID!,
//     clientSecret: process.env.SHIPBOB_CLIENT_SECRET!,
//     redirectUri: process.env.SHIPBOB_REDIRECT_URI!,
//     channelId: process.env.SHIPBOB_CHANNEL_ID!,
//     apiUrl: process.env.SHIPBOB_API_URL!,
//   }),
//   '4PX': new FourPXService({
//     clientId: process.env.FOURPX_CLIENT_ID!,
//     clientSecret: process.env.FOURPX_CLIENT_SECRET!,
//     redirectUri: process.env.FOURPX_REDIRECT_URI!,
//     apiUrl: process.env.FOURPX_API_URL!,
//   }),
//   ShipHero: new ShipHeroService({
//     clientId: process.env.SHIPHERO_CLIENT_ID!,
//     clientSecret: process.env.SHIPHERO_CLIENT_SECRET!,
//     apiUrl: process.env.SHIPHERO_API_URL!,
//   }),
// };

// أنواع البيانات
type ProductSortOption =
  | 'latest'
  | 'best-selling'
  | 'price-low-to-high'
  | 'price-high-to-low'
  | 'avg-customer-review'

interface ProductQueryFilters {
  search?: string;
  category?: string;
  tag?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  status?: 'active' | 'draft' | 'pending' | 'rejected';
  stock?: number;
}

interface ProductListResponse {
  products: IProduct[]
  totalPages: number
  totalProducts: number
  from: number
  to: number
}

interface ProductResponse {
  success: boolean
  message: string
  data?: any
  metadata?: any
  code?: string
}

// دوال مساعدة
async function getCurrentUserInfo() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return {
    userId: session.user.id,
    userName: session.user.name || session.user.email || session.user.id,
    userRole: session.user.role || '`User`',
  };
}


async function logOperation(operation: string, details: any) {
  const { userName } = await getCurrentUserInfo()
  console.log(`[${new Date().toISOString()}] 📝 ${operation}:`, {
    user: userName,
    ...details,
  })
}

async function validateSeller(userId: string) {
  const sellerResponse = await getSellerByUserId(userId)
  if (!sellerResponse.success || !sellerResponse.data) {
    throw new Error('Seller account required')
  }
  const isSubscribed = await checkSubscription(sellerResponse.data._id.toString())
  if (!isSubscribed) {
    throw new Error('Active subscription required')
  }
  return sellerResponse.data
}

// استرجاع كل المنتجات للمدير
export async function getAllProductsForAdmin({
  query = '',
  page = 1,
  sort = 'latest',
  limit,
}: {
  query?: string
  page?: number
  sort?: ProductSortOption
  limit?: number
}): Promise<ProductListResponse> {
  try {
    const { userRole } = await getCurrentUserInfo()
    if (userRole !== 'Admin') {
      throw new Error('Unauthorized: Admin access required')
    }

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
        ? { 'metrics.sales': -1 }
        : sort === 'price-low-to-high'
        ? { 'pricing.finalPrice': 1 }
        : sort === 'price-high-to-low'
        ? { 'pricing.finalPrice': -1 }
        : sort === 'avg-customer-review'
        ? { 'metrics.rating': -1 }
        : { updatedAt: -1 }

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
          metrics: 1,
          status: 1,
          warehouseData: 1,
        })
        .lean(),
      Product.countDocuments(queryFilter),
    ])

    await logOperation('Admin Products List Retrieved', {
      total: totalProducts,
      page,
      limit,
      sort,
    })

    return {
      products: JSON.parse(JSON.stringify(products)),
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
// إنشاء منتج جديد
export async function createProduct(data: z.infer<typeof ProductInputSchema>, providerId?: string, productId?: string): Promise<ProductResponse> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, userName, userRole } = await getCurrentUserInfo();
    const creationTime = new Date();

    if (userRole !== 'SELLER' && userRole !== 'Admin') {
      throw new Error('Only sellers and admins can create products');
    }

    await connectToDatabase();

    let seller = null;
    if (userRole === 'SELLER') {
      seller = await validateSeller(userId);
      await logOperation('Creating Product', {
        name: data.name,
        seller: seller.businessName,
      });
    } else {
      await logOperation('Creating Product (Admin)', {
        name: data.name,
        admin: userName,
      });
    }

    let productData: any;
    if (providerId && productId) {
      // استيراد منتج عبر الدروب شيبنج
      const importService = new ProductImportService();
      const importedProduct = await importService.importProduct(providerId, productId, seller ? seller._id.toString() : userId, data.region);
      productData = {
        ...importedProduct,
        sellerId: seller ? seller._id : null,
        createdBy: userName,
        updatedBy: userName,
        createdAt: creationTime,
        updatedAt: creationTime,
      };
    } else {
      // إنشاء منتج يدوياً
      const validatedData = (await ProductInputSchema()).parse({
        ...data,
        sellerId: seller ? seller._id : undefined,
      });

      const existingProduct = await Product.findOne({ slug: validatedData.slug }).session(session);
      if (existingProduct) {
        throw new Error('This slug already exists');
      }

      const provider = warehouseProviders[validatedData.warehouse.provider];
      if (!provider) {
        throw new Error('Invalid warehouse provider');
      }

      const warehouseResponse = await provider.createProduct({
        sku: validatedData.warehouse.sku,
        name: validatedData.name,
        description: validatedData.description,
        quantity: validatedData.warehouseData[0]?.quantity || 0,
        dimensions: validatedData.warehouse.dimensions,
        weight: validatedData.warehouse.weight,
      });

      const processedWarehouseData = validatedData.warehouseData.map((warehouse) => {
        const totalQuantity = warehouse.colors?.reduce((total, color) => {
          const colorTotal = color.sizes?.reduce((sum, size) => sum + (size.quantity || 0), 0) || 0;
          color.quantity = colorTotal;
          color.inStock = colorTotal > 0;
          return total + colorTotal;
        }, 0) || warehouse.quantity;

        return {
          ...warehouse,
          quantity: totalQuantity,
          lastUpdated: creationTime,
          updatedBy: userName,
        };
      });

      const totalStock = processedWarehouseData.reduce((sum, warehouse) => sum + warehouse.quantity, 0);

      const combinedColors = processedWarehouseData.reduce((allColors: any[], warehouse) => {
        if (warehouse.colors) {
          warehouse.colors.forEach((warehouseColor) => {
            const existingColor = allColors.find((c) => c.name === warehouseColor.name);
            if (existingColor) {
              existingColor.quantity += warehouseColor.quantity;
              existingColor.inStock = existingColor.quantity > 0;
              if (warehouseColor.sizes) {
                warehouseColor.sizes.forEach((warehouseSize) => {
                  const existingSize = existingColor.sizes.find((s) => s.name === warehouseSize.name);
                  if (existingSize) {
                    existingSize.quantity += warehouseSize.quantity;
                    existingSize.inStock = existingSize.quantity > 0;
                  } else {
                    existingColor.sizes.push({ ...warehouseSize });
                  }
                });
              }
            } else {
              allColors.push({
                ...warehouseColor,
                sizes: warehouseColor.sizes ? [...warehouseColor.sizes] : [],
              });
            }
          });
        }
        return allColors;
      }, []);

      const basePrice = Number(validatedData.price);
      const markup = Number(validatedData.pricing?.markup || 30);
      const commission = seller ? (seller.subscription.features?.commission || 3) : 0;
      const markupAmount = basePrice * (markup / 100);
      const commissionAmount = basePrice * (commission / 100);

      productData = {
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
        warehouse: {
          ...validatedData.warehouse,
          externalId: warehouseResponse.id,
        },
        colors: combinedColors,
        sizes: validatedData.sizes || ['S', 'M', 'L', 'XL', 'XXL'],
        isPublished: validatedData.isPublished || false,
        sellerId: seller ? seller._id : null,
        seller: seller
          ? {
              name: seller.businessName,
              email: seller.email,
              subscription: seller.subscription.plan,
            }
          : undefined,
        pricing: {
          basePrice,
          markup,
          profit: markupAmount - commissionAmount,
          commission: commissionAmount,
          finalPrice: basePrice + markupAmount,
          discount: validatedData.pricing?.discount,
        },
        metrics: {
          views: 0,
          sales: 0,
          revenue: 0,
          returns: 0,
          rating: 0,
        },
        status: validatedData.isPublished ? 'pending' : 'draft',
        inventoryStatus:
          totalStock === 0
            ? 'OUT_OF_STOCK'
            : totalStock <= Math.min(...processedWarehouseData.map((wh) => wh.minimumStock || 0))
            ? 'LOW_STOCK'
            : 'IN_STOCK',
        createdBy: userName,
        updatedBy: userName,
        createdAt: creationTime,
        updatedAt: creationTime,
      };
    }

    const product = await Product.create([productData], { session });
    const createdProduct = product[0];

    if (!providerId) {
      await Promise.all(
        productData.warehouseData.map((warehouse: any) =>
          updateWarehouseStock({
            productId: createdProduct._id,
            warehouseId: warehouse.warehouseId,
            quantity: warehouse.quantity,
            sku: warehouse.sku,
            location: warehouse.location,
            minimumStock: warehouse.minimumStock,
            reorderPoint: warehouse.reorderPoint,
            colors: warehouse.colors,
            updatedBy: userName,
          })
        )
      );
    }

    if (seller) {
      await updateSellerMetrics({
        sellerId: seller._id,
        updates: {
          productsCount: 1,
          lastProductCreated: creationTime,
        },
      });
    }

    await triggerWebhook({
      event: 'product.created',
      payload: {
        productId: createdProduct._id,
        name: createdProduct.name,
        sellerId: seller ? seller._id : null,
        createdAt: creationTime,
      },
    });

    await sendNotification({
      userId: seller ? seller._id.toString() : userId,
      type: 'product_created',
      title: 'New Product Created',
      message: `Product "${createdProduct.name}" has been created successfully${seller ? ' and is awaiting review' : ''}.`,
      channels: ['email', 'in_app'],
      data: { productId: createdProduct._id },
    });

    await session.commitTransaction();

    revalidatePath('/seller/dashboard/products');
    revalidatePath('/admin/products');
    revalidatePath(`/product/${createdProduct.slug}`);

    await logOperation('Product Created Successfully', {
      productId: createdProduct._id,
      name: createdProduct.name,
      totalStock: createdProduct.countInStock,
      colorsCount: createdProduct.colors.length,
      createdBy: userName,
    });

    return {
      success: true,
      message: 'Product created successfully',
      data: createdProduct,
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Product creation error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('slug') ? 'DUPLICATE_SLUG' : 'INVALID_REQUEST',
    };
  } finally {
    session.endSession();
  }
}

// تحديث منتج
export async function updateProduct(data: z.infer<typeof ProductUpdateSchema>, providerId?: string): Promise<ProductResponse> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, userName, userRole } = await getCurrentUserInfo();
    const updateTime = new Date();

    await connectToDatabase();

    const validatedData = (await ProductUpdateSchema()).parse(data);

    const existingProduct = await Product.findById(validatedData._id).session(session);
    if (!existingProduct) {
      throw new Error('Product not found');
    }

    if (userRole !== 'Admin' && existingProduct.sellerId.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    if (validatedData.slug !== existingProduct.slug) {
      const slugExists = await Product.findOne({ slug: validatedData.slug }).session(session);
      if (slugExists) {
        throw new Error('This slug already exists');
      }
    }

    const seller = await validateSeller(
      userRole === 'Admin' ? existingProduct.sellerId.toString() : userId
    );

    if (providerId) {
      // تحديث منتج دروب شيبنج
      const integration = await SellerIntegration.findOne({ sellerId: seller._id, integrationId: providerId, isActive: true });
      if (!integration) {
        throw new Error('Integration not connected');
      }
      const dynamicService = new DynamicIntegrationService(
        { _id: providerId, type: 'dropshipping', status: 'connected', providerName: integration.integrationId.providerName, settings: integration.integrationId.settings },
        integration
      );
      await dynamicService.updateProduct(existingProduct.sourceId, {
        name: validatedData.name,
        price: validatedData.price,
        quantity: validatedData.countInStock,
        sku: validatedData.sku,
        description: validatedData.description,
      });
    } else {
      // تحديث منتج يدوياً
      const provider = warehouseProviders[validatedData.warehouse.provider];
      if (!provider) {
        throw new Error('Invalid warehouse provider');
      }

      await provider.updateProduct({
        externalId: existingProduct.warehouse.externalId,
        sku: validatedData.warehouse.sku,
        name: validatedData.name,
        description: validatedData.description,
        quantity: validatedData.warehouseData[0]?.quantity || 0,
        dimensions: validatedData.warehouse.dimensions,
        weight: validatedData.warehouse.weight,
      });

      const processedWarehouseData = validatedData.warehouseData.map((warehouse) => {
        const totalQuantity = warehouse.colors?.reduce((total, color) => {
          const colorTotal = color.sizes?.reduce((sum, size) => sum + (size.quantity || 0), 0) || 0;
          color.quantity = colorTotal;
          color.inStock = colorTotal > 0;
          return total + colorTotal;
        }, 0) || warehouse.quantity;

        return {
          ...warehouse,
          quantity: totalQuantity,
          lastUpdated: updateTime,
          updatedBy: userName,
        };
      });

      const totalStock = processedWarehouseData.reduce((sum, warehouse) => sum + warehouse.quantity, 0);

      const combinedColors = processedWarehouseData.reduce((allColors: any[], warehouse) => {
        if (warehouse.colors) {
          warehouse.colors.forEach((warehouseColor) => {
            const existingColor = allColors.find((c) => c.name === warehouseColor.name);
            if (existingColor) {
              existingColor.quantity += warehouseColor.quantity;
              existingColor.inStock = existingColor.quantity > 0;
              if (warehouseColor.sizes) {
                warehouseColor.sizes.forEach((warehouseSize) => {
                  const existingSize = existingColor.sizes.find((s) => s.name === warehouseSize.name);
                  if (existingSize) {
                    existingSize.quantity += warehouseSize.quantity;
                    existingSize.inStock = existingSize.quantity > 0;
                  } else {
                    existingColor.sizes.push({ ...warehouseSize });
                  }
                });
              }
            } else {
              allColors.push({
                ...warehouseColor,
                sizes: warehouseColor.sizes ? [...warehouseColor.sizes] : [],
              });
            }
          });
        }
        return allColors;
      }, []);

      let pricing = existingProduct.pricing;
      if (
        validatedData.price !== existingProduct.price ||
        validatedData.pricing?.markup !== existingProduct.pricing.markup
      ) {
        const basePrice = Number(validatedData.price);
        const markup = Number(validatedData.pricing?.markup || existingProduct.pricing.markup);
        const commission = seller.subscription.features?.commission || 3;
        const markupAmount = basePrice * (markup / 100);
        const commissionAmount = basePrice * (commission / 100);

        pricing = {
          basePrice,
          markup,
          profit: markupAmount - commissionAmount,
          commission: commissionAmount,
          finalPrice: basePrice + markupAmount,
          discount: validatedData.pricing?.discount,
        };
      }

      const isStockStatusChanged =
        (existingProduct.countInStock > 0 && totalStock === 0) ||
        (existingProduct.countInStock === 0 && totalStock > 0);

      const updateData = {
        ...validatedData,
        name: validatedData.name.trim(),
        slug: validatedData.slug.trim(),
        category: validatedData.category.trim(),
        brand: validatedData.brand.trim(),
        description: validatedData.description.trim(),
        price: Number(validatedData.price),
        listPrice: Number(validatedData.listPrice) || Number(validatedData.price),
        countInStock: totalStock,
        warehouseData: processedWarehouseData,
        colors: combinedColors,
        sizes: validatedData.sizes || existingProduct.sizes,
        pricing,
        status: validatedData.isPublished
          ? existingProduct.status === 'active'
            ? 'active'
            : 'pending'
          : 'draft',
        inventoryStatus:
          totalStock === 0
            ? 'OUT_OF_STOCK'
            : totalStock <= Math.min(...processedWarehouseData.map((wh) => wh.minimumStock || 0))
            ? 'LOW_STOCK'
            : 'IN_STOCK',
        updatedAt: updateTime,
        updatedBy: userName,
      };

      const updatedProduct = await Product.findByIdAndUpdate(validatedData._id, updateData, {
        new: true,
        session,
      });

      await Promise.all(
        processedWarehouseData.map((warehouse) =>
          updateWarehouseStock({
            productId: updatedProduct._id,
            warehouseId: warehouse.warehouseId,
            quantity: warehouse.quantity,
            sku: warehouse.sku,
            location: warehouse.location,
            minimumStock: warehouse.minimumStock,
            reorderPoint: warehouse.reorderPoint,
            colors: warehouse.colors,
            updatedBy: userName,
          })
        )
      );

      if (isStockStatusChanged) {
        await updateSellerMetrics({
          sellerId: seller._id,
          updates: {
            action: totalStock === 0 ? 'product_out_of_stock' : 'product_back_in_stock',
          },
        });
      }

      await triggerWebhook({
        event: 'product.updated',
        payload: {
          productId: updatedProduct._id,
          name: updatedProduct.name,
          sellerId: seller._id,
          updatedAt: updateTime,
        },
      });

      await sendNotification({
        userId: seller._id.toString(),
        type: 'product_updated',
        title: 'Product Updated',
        message: `Your product "${updatedProduct.name}" has been updated successfully`,
        channels: ['email', 'in_app'],
        priority: 'medium',
        data: { productId: updatedProduct._id },
      });

      await session.commitTransaction();

      revalidatePath('/seller/dashboard/products');
      revalidatePath('/admin/products');
      revalidatePath(`/product/${updatedProduct.slug}`);

      await logOperation('Product Updated', {
        productId: updatedProduct._id,
        name: updatedProduct.name,
        updatedBy: userName,
      });

      return {
        success: true,
        message: 'Product updated successfully',
        data: updatedProduct,
      };
    }
  } catch (error) {
    await session.abortTransaction();
    console.error('Product update error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('slug') ? 'DUPLICATE_SLUG' : 'INVALID_REQUEST',
    };
  } finally {
    session.endSession();
  }
}

// حذف منتج
export async function deleteProduct(id: string): Promise<ProductResponse> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, userName, userRole } = await getCurrentUserInfo();

    await connectToDatabase();

    const product = await Product.findById(id).session(session);
    if (!product) {
      throw new Error('Product not found');
    }

    if (userRole !== 'Admin' && product.sellerId.toString() !== userId) {
      throw new Error('Unauthorized');
    }

    if (product.source) {
      // حذف منتج دروب شيبنج
      const integration = await SellerIntegration.findOne({ sellerId: product.sellerId, isActive: true });
      if (integration) {
        const dynamicService = new DynamicIntegrationService(
          { _id: integration.integrationId.toString(), type: 'dropshipping', status: 'connected', providerName: integration.integrationId.providerName, settings: integration.integrationId.settings },
          integration
        );
        await dynamicService.deleteProduct(product.sourceId);
      }
    } else {
      const provider = warehouseProviders[product.warehouse.provider];
      if (!provider) {
        throw new Error('Invalid warehouse provider');
      }

      await provider.deleteProduct({
        externalId: product.warehouse.externalId,
      });
    }

    await Product.findByIdAndDelete(id).session(session);

    await updateSellerMetrics({
      sellerId: product.sellerId,
      updates: {
        productsCount: -1,
        lastUpdated: new Date(),
      },
    });

    await triggerWebhook({
      event: 'product.deleted',
      payload: {
        productId: id,
        name: product.name,
        sellerId: product.sellerId,
        deletedAt: new Date(),
      },
    });

    await sendNotification({
      userId: product.sellerId.toString(),
      type: 'product_deleted',
      title: 'Product Deleted',
      message: `Your product "${product.name}" has been deleted`,
      data: {
        productId: id,
      },
      channels: ['email', 'in_app'],
      priority: 'high',
    });

    await session.commitTransaction();

    revalidatePath('/seller/dashboard/products');
    revalidatePath('/admin/products');
    revalidatePath(`/product/${product.slug}`);

    await logOperation('Product Deleted', {
      productId: id,
      name: product.name,
      deletedBy: userName,
    });

    return {
      success: true,
      message: 'Product deleted successfully',
      data: { id },
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Product deletion error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'INVALID_REQUEST',
    };
  } finally {
    session.endSession();
  }
}
// مراجعة منتج (للمدير فقط)
export async function reviewProduct(
  productId: string,
  approved: boolean,
  notes?: string
): Promise<ProductResponse> {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { userId, userName, userRole } = await getCurrentUserInfo()

    if (userRole !== 'Admin') {
      throw new Error('Admin access required')
    }

    await connectToDatabase()

    const product = await Product.findById(productId).session(session)
    if (!product) {
      throw new Error('Product not found')
    }

    const updateData = {
      status: approved ? 'active' : 'rejected',
      adminReview: {
        approvedBy: userId,
        approvedAt: new Date(),
        notes,
      },
      updatedAt: new Date(),
      updatedBy: userName,
    }

    const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, {
      new: true,
      session,
    })

    await sendNotification({
      userId: product.sellerId.toString(),
      type: 'product_reviewed',
      title: `Product ${approved ? 'Approved' : 'Rejected'}`,
      message: `Your product "${product.name}" has been ${approved ? 'approved' : 'rejected'}. ${notes || ''}`,
      channels: ['email', 'in_app'],
      priority: 'high',
      data: { productId },
    })

    await triggerWebhook({
      event: approved ? 'product.approved' : 'product.rejected',
      payload: {
        productId,
        status: updateData.status,
        reviewedAt: updateData.updatedAt,
      },
    })

    await session.commitTransaction()

    revalidatePath('/admin/products')
    revalidatePath(`/product/${product.slug}`)

    await logOperation(`Product ${approved ? 'Approved' : 'Rejected'}`, {
      productId,
      updatedBy: userName,
    })

    return {
      success: true,
      message: `Product ${approved ? 'approved' : 'rejected'} successfully`,
      data: updatedProduct,
    }
  } catch (error) {
    await session.abortTransaction()
    console.error('Product review error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'INVALID_REQUEST',
    }
  } finally {
    session.endSession()
  }
}



// مزامنة مخزون المنتج
export async function syncProductInventory(productId: string, providerId?: string): Promise<ProductResponse> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, userName } = await getCurrentUserInfo();

    await connectToDatabase();

    const product = await Product.findById(productId).session(session);
    if (!product) {
      throw new Error('Product not found');
    }

    if (product.sellerId.toString() !== userId) {
      throw new Error('Unauthorized to sync this product');
    }

    let inventory: any;
    if (providerId && product.source) {
      // مزامنة مخزون دروب شيبنج
      const importService = new ProductImportService();
      inventory = await importService.syncInventory(product.sourceId, userId, providerId);
    } else {
      // مزامنة مخزون المستودع
      const provider = warehouseProviders[product.warehouse.provider];
      if (!provider) {
        throw new Error('Invalid warehouse provider');
      }

      inventory = await provider.getInventory({
        sku: product.warehouse.sku,
      });
    }

    const processedWarehouseData = product.warehouseData.map((warehouse: any) => {
      if (warehouse.sku === product.warehouse.sku) {
        return {
          ...warehouse,
          quantity: inventory.quantity,
          location: inventory.location,
          lastSync: new Date(),
          lastUpdated: new Date(),
          updatedBy: userName,
        };
      }
      return warehouse;
    });

    const totalStock = processedWarehouseData.reduce((sum: number, warehouse: any) => sum + warehouse.quantity, 0);

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        warehouseData: processedWarehouseData,
        countInStock: totalStock,
        warehouse: {
          ...product.warehouse,
          availableQuantity: totalStock,
          location: inventory.location,
          lastSync: new Date(),
        },
        inventoryStatus:
          totalStock === 0
            ? 'OUT_OF_STOCK'
            : totalStock <= Math.min(...processedWarehouseData.map((wh: any) => wh.minimumStock || 0))
            ? 'LOW_STOCK'
            : 'IN_STOCK',
        updatedAt: new Date(),
        updatedBy: userName,
      },
      { new: true, session }
    );

    await triggerWebhook({
      event: 'product.inventory_synced',
      payload: {
        productId,
        totalStock,
        syncedAt: new Date(),
      },
    });

    await session.commitTransaction();

    revalidatePath('/seller/dashboard/products');
    revalidatePath(`/product/${product.slug}`);

    await logOperation('Product Inventory Synced', {
      productId,
      totalStock,
      updatedBy: userName,
    });

    return {
      success: true,
      message: 'Inventory synced successfully',
      data: { inventory, totalStock },
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Inventory sync error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'INVALID_REQUEST',
    };
  } finally {
    session.endSession();
  }
}

// إرسال تقييم لمنتج
export async function submitProductReview({
  productId,
  rating,
  title,
  comment,
  isVerifiedPurchase = false,
}: {
  productId: string;
  rating: number;
  title?: string;
  comment?: string;
  isVerifiedPurchase?: boolean;
}): Promise<ProductResponse> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, userName } = await getCurrentUserInfo();

    await connectToDatabase();

    const product = await Product.findById(productId).session(session);
    if (!product) {
      throw new Error('Product not found');
    }

    const existingReview = product.reviews.find(
      (review: any) => review.user.toString() === userId
    );
    if (existingReview) {
      throw new Error('You have already reviewed this product');
    }

    const review = {
      user: userId,
      name: userName,
      rating,
      title: title?.trim(),
      comment: comment?.trim(),
      isVerifiedPurchase,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    product.reviews.push(review);

    const totalRatings = product.reviews.reduce((sum: number, r: any) => sum + r.rating, 0);
    const avgRating = totalRatings / product.reviews.length;
    const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
      rating: star,
      count: product.reviews.filter((r: any) => r.rating === star).length,
    }));

    product.avgRating = avgRating;
    product.numReviews = product.reviews.length;
    product.ratingDistribution = ratingDistribution;
    product.metrics.rating = avgRating;

    await product.save({ session });

    await sendNotification({
      userId: product.sellerId.toString(),
      type: 'product_review_added',
      title: 'New Product Review',
      message: `Your product "${product.name}" received a ${rating}-star review: ${comment || ''}`,
      channels: ['email', 'in_app'],
      priority: 'medium',
      data: { productId },
    });

    await triggerWebhook({
      event: 'product.review_added',
      payload: {
        productId,
        rating,
        reviewCount: product.reviews.length,
        createdAt: review.createdAt,
      },
    });

    await session.commitTransaction();

    revalidatePath(`/product/${product.slug}`);

    await logOperation('Product Review Submitted', {
      productId,
      userId,
      rating,
      title,
    });

    return {
      success: true,
      message: 'Review submitted successfully',
      data: review,
    };
  } catch (error) {
    await session.abortTransaction();
    console.error('Review submission error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'INVALID_REQUEST',
    };
  } finally {
    session.endSession();
  }
}

// استرجاع منتج مع تقييماته
export async function getProductByIdWithReviews(productId: string): Promise<ProductResponse> {
  try {
    await connectToDatabase();

    const product = await Product.findById(productId)
      .select('-__v')
      .populate('reviews.user', 'name email')
      .lean();

    if (!product) {
      throw new Error('Product not found');
    }

    const formattedProduct = {
      ...product,
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : undefined,
      updatedAt: product.updatedAt ? new Date(product.updatedAt).toISOString() : undefined,
      reviews: product.reviews.map((review: any) => ({
        ...review,
        createdAt: review.createdAt ? new Date(review.createdAt).toISOString() : undefined,
        updatedAt: review.updatedAt ? new Date(review.updatedAt).toISOString() : undefined,
      })),
    };

    const { userId } = await getCurrentUserInfo();
    await logOperation('Product with Reviews Accessed', {
      productId,
      userId,
    });

    return {
      success: true,
      message: 'Product retrieved successfully',
      data: formattedProduct,
    };
  } catch (error) {
    console.error('Product retrieval error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'INVALID_REQUEST',
    };
  }
}

// استرجاع فئات المنتجات
export async function getProductCategories(limit = 4): Promise<any[]> {
  try {
    await connectToDatabase();

    const categories = await Product.aggregate([
      {
        $match: {
          isPublished: true,
          status: 'active',
          countInStock: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$category',
          productCount: { $sum: 1 },
          totalSales: { $sum: '$metrics.sales' },
          images: { $first: '$images' },
          latestProduct: {
            $first: {
              name: '$name',
              slug: '$slug',
              images: '$images',
            },
          },
        },
      },
      {
        $sort: {
          productCount: -1,
          totalSales: -1,
        },
      },
      {
        $limit: limit,
      },
      {
        $project: {
          name: '$_id',
          image: { $arrayElemAt: ['$latestProduct.images', 0] },
          slug: '$latestProduct.slug',
          productCount: 1,
          _id: 0,
        },
      },
    ]);

    return categories;
  } catch (error) {
    console.error('Category retrieval error:', error);
    return [];
  }
}

// استرجاع منتجات لبطاقات العرض
export async function getProductsForCard({
  tag,
  limit = 4,
}: {
  tag: string
  limit?: number
}): Promise<
  {
    name: string
    productId: string
    slug: string
    images: string[]
    price: any
    metrics: any
    href?: string
    image?: string
  }[]
> {
  try {
    await connectToDatabase()

    const products = await Product.aggregate([
      {
        $match: {
          tags: { $in: [tag] },
          isPublished: true,
          status: 'active',
          countInStock: { $gt: 0 },
        },
      },
      {
        $project: {
          name: 1,
          productId: '$_id',
          slug: 1,
          images: 1,
          price: 1,
          metrics: 1,
          href: { $concat: ['/product/', '$slug'] },
          image: { $arrayElemAt: ['$images', 0] },
        },
      },
      {
        $sort: { 'metrics.sales': -1, createdAt: -1 },
      },
      {
        $limit: limit,
      },
    ])

    return products
  } catch (error) {
    console.error('Product card retrieval error:', error)
    return []
  }
}

// استرجاع المنتجات حسب الوسم
export async function getProductsByTag({
  tag,
  limit = 10,
  sortBy = 'relevance',
}: {
  tag: string
  limit?: number
  sortBy?: 'relevance' | 'createdAt'
}): Promise<IProduct[]> {
  try {
    await connectToDatabase()

    const query: any = {
      tags: { $in: [tag] },
      isPublished: true,
    }

    if (sortBy === 'relevance') {
      query.status = 'active'
      query.countInStock = { $gt: 0 }
    }

    const sortOption = sortBy === 'relevance' ? { 'metrics.sales': -1 } : { createdAt: -1 }

    const products = await Product.find(query)
      .sort(sortOption)
      .limit(limit)
      .lean()

    return products
  } catch (error) {
    console.error('Tag-based product retrieval error:', error)
    return []
  }
}

// استرجاع أحدث المنتجات
export async function getLatestProducts({ limit = 4 }: { limit?: number } = {}): Promise<IProduct[]> {
  try {
    await connectToDatabase()

    const products = await Product.find({
      isPublished: true,
      status: 'active',
      countInStock: { $gt: 0 },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select({
        name: 1,
        images: 1,
        slug: 1,
        price: 1,
      })
      .lean()

    return products
  } catch (error) {
    console.error('Latest products retrieval error:', error)
    return []
  }
}

// استرجاع كل المنتجات
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
  sort?: ProductSortOption
  page?: number
  limit?: number
  price?: string
  rating?: number
}): Promise<ProductListResponse> {
  try {
    await connectToDatabase()

    const {
      common: { pageSize },
    } = await getSetting()
    limit = limit || pageSize

    const queryFilter: any = {
      isPublished: true,
      status: 'active',
      countInStock: { $gt: 0 },
    }

    if (query && query !== 'all') {
      queryFilter.name = { $regex: query, $options: 'i' }
    }

    if (category && category !== 'all') {
      queryFilter.category = category
    }

    if (tag && tag !== 'all') {
      queryFilter.tags = { $in: [tag] }
    }

    if (rating) {
      queryFilter['metrics.rating'] = { $gte: Number(rating) }
    }

    if (price && price !== 'all') {
      const [minPrice, maxPrice] = price.split('-').map(Number)
      queryFilter['pricing.finalPrice'] = {
        $gte: minPrice,
        $lte: maxPrice,
      }
    }

    const sortOption: Record<string, 1 | -1> =
      sort === 'best-selling'
        ? { 'metrics.sales': -1 }
        : sort === 'price-low-to-high'
        ? { 'pricing.finalPrice': 1 }
        : sort === 'price-high-to-low'
        ? { 'pricing.finalPrice': -1 }
        : sort === 'avg-customer-review'
        ? { 'metrics.rating': -1 }
        : { createdAt: -1 }

    const skip = (page - 1) * limit

    const [products, totalProducts] = await Promise.all([
      Product.find(queryFilter)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(queryFilter),
    ])

    return {
      products,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      from: skip + 1,
      to: skip + products.length,
    }
  } catch (error) {
    console.error('Product retrieval error:', error)
    return {
      products: [],
      totalPages: 0,
      totalProducts: 0,
      from: 0,
      to: 0,
    }
  }
}

// استرجاع منتج حسب المعرف
export async function getProductById(productId: string): Promise<ProductResponse> {
  try {
    await connectToDatabase()

    const product = await Product.findById(productId)
      .select('-__v')
      .lean()

    if (!product) {
      throw new Error('Product not found')
    }

    const formattedProduct = {
      ...product,
      createdAt: product.createdAt ? new Date(product.createdAt).toISOString() : undefined,
      updatedAt: product.updatedAt ? new Date(product.updatedAt).toISOString() : undefined,
    }

    const { userId } = await getCurrentUserInfo()
    await logOperation('Product Accessed', {
      productId,
      userId,
    })

    return {
      success: true,
      message: 'Product retrieved successfully',
      data: formattedProduct,
    }
  } catch (error) {
    console.error('Product retrieval error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'INVALID_REQUEST',
    }
  }
}

// استرجاع منتج حسب الـ slug
export async function getProductBySlug(slug: string): Promise<IProduct> {
  try {
    await connectToDatabase()
    const product = await Product.findOne({
      slug,
      isPublished: true,
      status: 'active',
    }).lean()

    if (!product) {
      throw new Error('Product not found')
    }

    return product
  } catch (error) {
    console.error('Product slug retrieval error:', error)
    throw error instanceof Error ? error : new Error(formatError(error))
  }
}

// استرجاع المنتجات ذات الصلة
export async function getRelatedProducts({
  productId,
  category,
  limit = 4,
}: {
  productId: string
  category: string
  limit: number
}): Promise<IProduct[]> {
  try {
    await connectToDatabase()

    const products = await Product.find({
      _id: { $ne: productId },
      category,
      isPublished: true,
      status: 'active',
      countInStock: { $gt: 0 },
    })
      .sort({ 'metrics.sales': -1 })
      .limit(limit)
      .select({
        name: 1,
        images: 1,
        slug: 1,
        price: 1,
      })
      .lean()

    return products
  } catch (error) {
    console.error('Related products retrieval error:', error)
    return []
  }
}

// استرجاع المنتجات ذات الصلة حسب الفئة
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

    const skip = (page - 1) * limit
    const conditions = {
      isPublished: true,
      category,
      _id: { $ne: productId },
      status: 'active',
      countInStock: { $gt: 0 },
    }

    const [products, totalProducts] = await Promise.all([
      Product.find(conditions)
        .sort({ 'metrics.sales': -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(conditions),
    ])

    return {
      data: products,
      totalPages: Math.ceil(totalProducts / limit),
    }
  } catch (error) {
    console.error('Related products by category retrieval error:', error)
    return { data: [], totalPages: 0 }
  }
}

// استرجاع كل الوسوم
export async function getAllTags(): Promise<string[]> {
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
    console.error('Tags retrieval error:', error)
    return []
  }
}

// استرجاع كل الفئات
export async function getAllCategories(): Promise<string[]> {
  try {
    await connectToDatabase()

    const categories = await Product.distinct('category', {
      isPublished: true,
      status: 'active',
    })

    return categories
  } catch (error) {
    console.error('Categories retrieval error:', error)
    return []
  }
}

// استرجاع منتجات بائع معين
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
        { slug: { $regex: query, $options: 'i' } },
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
          metrics: 1,
          status: 1,
          warehouseData: 1,
        })
        .lean(),
      Product.countDocuments(queryFilter),
    ])

    await logOperation('Seller Products Retrieved', {
      sellerId,
      total: totalProducts,
      page,
      limit,
    })

    return {
      products,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
      from: skip + 1,
      to: skip + products.length,
    }
  } catch (error) {
    console.error('Seller products retrieval error:', error)
    return {
      products: [],
      totalPages: 0,
      totalProducts: 0,
      from: 0,
      to: 0,
    }
  }
}

// استرجاع إحصائيات المنتجات
export async function getProductStats({
  sellerId,
  startDate,
  endDate,
}: {
  sellerId?: string
  startDate?: Date
  endDate?: Date
}): Promise<ProductResponse> {
  try {
    const { userId, userRole } = await getCurrentUserInfo()
    if (userRole !== 'Admin' && userRole !== 'SELLER') {
      throw new Error('Unauthorized')
    }

    await connectToDatabase()

    const query: any = userRole === 'SELLER' ? { sellerId: userId } : sellerId ? { sellerId } : {}
    if (startDate && endDate) {
      query.createdAt = { $gte: startDate, $lte: endDate }
    }

    const stats = await Product.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalViews: { $sum: '$metrics.views' },
          totalSales: { $sum: '$metrics.sales' },
          averagePrice: { $avg: '$pricing.finalPrice' },
          activeProducts: {
            $sum: { $cond: [{ $gt: ['$countInStock', 0] }, 1, 0] },
          },
        },
      },
    ])

    return {
      success: true,
      message: 'Product statistics retrieved successfully',
      data: stats[0] || {
        totalProducts: 0,
        totalViews: 0,
        totalSales: 0,
        averagePrice: 0,
        activeProducts: 0,
      },
    }
  } catch (error) {
    console.error('Get product stats error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'INVALID_REQUEST',
    }
  }
}

// تصدير المنتجات
export async function exportProducts({
  sellerId,
  format = 'csv',
}: {
  sellerId?: string
  format?: 'csv'
}): Promise<ProductResponse> {
  try {
    const { userId, userRole, userName } = await getCurrentUserInfo()
    if (userRole !== 'Admin' && userRole !== 'SELLER') {
      throw new Error('Unauthorized')
    }

    await connectToDatabase()

    const query = userRole === 'SELLER' ? { sellerId: userId } : sellerId ? { sellerId } : {}
    
    const products = await Product.find(query).lean()

    if (!products.length) {
      throw new Error('No products found to export')
    }

    const fields = [
      '_id',
      'name',
      'slug',
      'description',
      'pricing.basePrice',
      'pricing.finalPrice',
      'countInStock',
      'category',
      'tags',
      'sellerId',
      'createdAt',
      'updatedAt',
    ]
    const json2csvParser = new Parser({ fields })
    const csv = json2csvParser.parse(products)

    await logOperation('Products Exported', {
      userId,
      userName,
      productCount: products.length,
      format,
    })

    return {
      success: true,
      message: 'Products exported successfully',
      data: {
        content: csv,
        format,
        count: products.length,
      },
    }
  } catch (error) {
    console.error('Export products error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'INVALID_REQUEST',
    }
  }
}

// تطبيق خصم على منتج
export async function applyDiscount({
  productId,
  discountPercentage,
  startDate,
  endDate,
}: {
  productId: string
  discountPercentage: number
  startDate: Date
  endDate: Date
}): Promise<ProductResponse> {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { userId, userName, userRole } = await getCurrentUserInfo()
    if (userRole !== 'Admin' && userRole !== 'SELLER') {
      throw new Error('Unauthorized')
    }

    await connectToDatabase()

    const product = await Product.findById(productId).session(session)
    if (!product) {
      throw new Error('Product not found')
    }

    if (userRole === 'SELLER' && product.sellerId.toString() !== userId) {
      throw new Error('Unauthorized to modify this product')
    }

    const discount = {
      percentage: discountPercentage,
      startDate,
      endDate,
      appliedBy: userName,
      appliedAt: new Date(),
    }

    product.pricing.discount = discount
    product.pricing.finalPrice = product.pricing.basePrice * (1 - discountPercentage / 100)

    await product.save({ session })

    await triggerWebhook({
      event: 'product.discount_applied',
      payload: {
        productId,
        discountPercentage,
        startDate,
        endDate,
        appliedBy: userId,
      },
    })

    await sendNotification({
      userId: product.sellerId.toString(),
      type: 'product_discount_applied',
      title: 'Discount Applied',
      message: `A ${discountPercentage}% discount has been applied to "${product.name}" from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}.`,
      channels: ['email', 'in_app'],
      priority: 'medium',
      data: { productId },
    })

    await session.commitTransaction()

    revalidatePath(`/product/${product.slug}`)
    revalidatePath('/seller/dashboard/products')

    await logOperation('Discount Applied', {
      productId,
      discountPercentage,
      appliedBy: userName,
    })

    return {
      success: true,
      message: 'Discount applied successfully',
      data: product,
    }
  } catch (error) {
    await session.abortTransaction()
    console.error('Apply discount error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : formatError(error),
      code: error instanceof Error && error.message.includes('not found') ? 'NOT_FOUND' : 'INVALID_REQUEST',
    }
  } finally {
    session.endSession()
  }
}