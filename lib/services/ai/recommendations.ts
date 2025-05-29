import { OpenAI } from 'openai'
import { connectToDatabase } from '@/lib/db'
import Product from '@/lib/db/models/product.model'
import Order from '@/lib/db/models/order.model'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export class RecommendationService {
  async getPersonalizedRecommendations(userId: string, limit = 10) {
    try {
      await connectToDatabase()

      // Get user's purchase history
      const orders = await Order.find({ 
        userId, 
        isPaid: true 
      }).populate('items.product')

      // Extract product details and categories
      const purchasedProducts = orders.flatMap(order => 
        order.items.map(item => ({
          name: item.name,
          category: item.category,
          price: item.price
        }))
      )

      // Generate embedding for user preferences
      const userPreferences = await this.generateUserPreferences(purchasedProducts)

      // Get similar products
      const recommendedProducts = await this.getSimilarProducts(
        userPreferences,
        purchasedProducts.map(p => p.name),
        limit
      )

      return { success: true, data: recommendedProducts }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  async getTrendingProducts(category?: string, limit = 10) {
    try {
      await connectToDatabase()

      const match = category ? { category } : {}
      
      const trending = await Order.aggregate([
        { $match: { isPaid: true } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.product',
            totalSales: { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
          }
        },
        { $sort: { totalSales: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product'
          }
        },
        { $unwind: '$product' },
        {
          $project: {
            _id: '$product._id',
            name: '$product.name',
            category: '$product.category',
            price: '$product.price',
            totalSales: 1,
            totalRevenue: 1
          }
        }
      ])

      return { success: true, data: trending }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  private async generateUserPreferences(purchasedProducts: any[]) {
    const prompt = `
      Analyze these purchased products and create a user preference profile:
      ${JSON.stringify(purchasedProducts)}
      
      Consider:
      1. Preferred categories
      2. Price range
      3. Style preferences
      4. Brand preferences
      
      Return the analysis as a concise JSON object.
    `

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    })

    return JSON.parse(completion.choices[0].message.content)
  }

  private async getSimilarProducts(
    userPreferences: any,
    excludeProducts: string[],
    limit: number
  ) {
    const query: any = {
      name: { $nin: excludeProducts },
      isPublished: true,
    }

    if (userPreferences.categories?.length) {
      query.category = { $in: userPreferences.categories }
    }

    if (userPreferences.priceRange) {
      query.price = {
        $gte: userPreferences.priceRange.min,
        $lte: userPreferences.priceRange.max,
      }
    }

    const products = await Product.find(query)
      .sort({ avgRating: -1 })
      .limit(limit)

    return products
  }

  async generateProductDescription(
    product: {
      name: string
      category: string
      features: string[]
      specifications: any
    }
  ) {
    const prompt = `
      Generate an engaging product description for:
      ${JSON.stringify(product)}
      
      Include:
      1. Compelling opening
      2. Key features and benefits
      3. Technical specifications
      4. Ideal use cases
      5. Call to action
      
      Make it persuasive but honest, around 200 words.
    `

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
    })

    return completion.choices[0].message.content
  }
}