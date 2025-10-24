import { NextResponse } from 'next/server'
import mongoose, { Connection } from 'mongoose'
import { newsArticleSchema } from '@/lib/db/models/news.model'

let connection: Connection | null = null

const connectToHagerDatabase = async () => {
  if (!connection || connection.readyState === 0) {
    try {
      connection = await mongoose.createConnection(process.env.MONGODB_HAGER_URI as string)
      console.log('Connected to Hager MongoDB')
    } catch (error: any) {
      console.error('Hager MongoDB connection error:', error)
      throw new Error('Failed to connect to hager database')
    }
  }
  return connection
}

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const connection = await connectToHagerDatabase()
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema)
    const article = await NewsArticle.findOne({ slug: params.slug, isPublished: true })
      .populate('authorId', 'name')
    if (!article) {
      return NextResponse.json({ success: false, message: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, ...article.toJSON() })
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 })
  }
}