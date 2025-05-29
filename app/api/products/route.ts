import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createProduct, getSellerProducts } from '@/lib/actions/product.actions'
import { getSellerByUserId } from '@/lib/actions/seller.actions'
import Warehouse from '@/lib/db/models/warehouse.model'

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a seller
    const sellerResponse = await getSellerByUserId(session.user.id!)
    if (!sellerResponse.success || !sellerResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Seller account required' },
        { status: 403 }
      )
    }

    const seller = sellerResponse.data

    // Check seller subscription status and plan
    if (seller.subscription.status !== 'active') {
      return NextResponse.json(
        { success: false, message: 'Subscription required' },
        { status: 403 }
      )
    }

    // Check product limits
    const productsCount = seller.metrics.productsCount || 0
    const productsLimit = seller.subscription.features.productsLimit
    if (productsCount >= productsLimit) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Product limit (${productsLimit}) reached for your subscription plan` 
        },
        { status: 403 }
      )
    }

    const data = await req.json()
    console.log("📥 Data received in API:", data)

    // Validate warehouse
    const warehouseId = data.warehouseData?.[0]?.warehouseId
    if (warehouseId) {
      const warehouse = await Warehouse.findById(warehouseId)
      if (!warehouse) {
        return NextResponse.json(
          { success: false, message: `Invalid warehouse ID: ${warehouseId}` },
          { status: 400 }
        )
      }
      data.warehouseData[0].warehouseId = warehouse._id // Ensure _id is used
    }

    // Assign tags based on subscription plan
    let tags = ['new-arrival'] // Default tag for new products
    switch (seller.subscription.plan) {
      case 'Trial':
      case 'Basic':
        tags.push('standard')
        break
      case 'Pro':
        tags.push('featured')
        break
      case 'VIP':
        tags.push('premium')
        break
      default:
        tags.push('standard')
    }

    // Add seller data and tags to product
    const productData = {
      ...data,
      tags,
      sellerId: seller._id,
      commission: seller.subscription.features.commission || 3,
      seller: {
        name: seller.businessName,
        email: seller.email,
        subscription: seller.subscription.plan
      }
    }

    const result = await createProduct(productData)
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Create product error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create product'
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') as 'active' | 'draft' | 'outOfStock' | undefined
    const category = searchParams.get('category') || ''
    const sortBy = searchParams.get('sortBy') as 'createdAt' | 'price' | 'stock' | 'sales' | undefined
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' | undefined

    // Check if user is a seller
    const sellerResponse = await getSellerByUserId(session.user.id!)
    if (!sellerResponse.success || !sellerResponse.data) {
      return NextResponse.json(
        { success: false, message: 'Seller account required' },
        { status: 403 }
      )
    }

    const filters = {
      page,
      limit,
      search,
      status,
      category,
      sortBy,
      sortOrder
    }

    const result = await getSellerProducts({ sellerId: session.user.id!, ...filters })
    return NextResponse.json(result)

  } catch (error) {
    console.error('Get products error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get products'
      },
      { status: 500 }
    )
  }
}