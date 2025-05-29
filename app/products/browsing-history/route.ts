import { NextRequest, NextResponse } from 'next/server'
import Product from '@/lib/db/models/product.model'
import { connectToDatabase } from '@/lib/db'
import mongoose from 'mongoose'

export async function GET(request: NextRequest) {
  try {
    const listType = request.nextUrl.searchParams.get('type') || 'history'
    const productIdsParam = request.nextUrl.searchParams.get('ids')
    const categoriesParam = request.nextUrl.searchParams.get('categories')
    const excludeId = request.nextUrl.searchParams.get('excludeId')

    if (!productIdsParam || !categoriesParam) {
      return NextResponse.json({ success: true, data: [] })
    }

    await connectToDatabase()

    const productIds = productIdsParam.split(',').filter(Boolean)
    const categories = categoriesParam.split(',').filter(Boolean)

    // Convert string IDs to MongoDB ObjectIDs
    const objectIds = productIds.map(id => new mongoose.Types.ObjectId(id))

    let filter: any = {}

    if (listType === 'history') {
      filter = {
        _id: { $in: objectIds }
      }
    } else {
      filter = {
        category: { $in: categories },
        _id: { $nin: objectIds }
      }

      if (excludeId) {
        filter._id.$ne = new mongoose.Types.ObjectId(excludeId)
      }
    }

    const products = await Product.find(filter)
      .limit(listType === 'related' ? 4 : productIds.length)
      .select('name slug images price category brand ratings reviews')
      .lean()

    if (listType === 'history') {
      // Sort products according to the original order
      products.sort((a, b) => {
        const aIndex = productIds.indexOf(a._id.toString())
        const bIndex = productIds.indexOf(b._id.toString())
        return aIndex - bIndex
      })
    }

    return NextResponse.json({
      success: true,
      data: products
    })

  } catch (error) {
    console.error('Browsing history error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch products'
      },
      { status: 500 }
    )
  }
}