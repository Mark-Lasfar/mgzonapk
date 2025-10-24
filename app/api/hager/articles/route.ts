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

export async function GET(request: Request) {
  try {
    const connection = await connectToHagerDatabase()
    const NewsArticle = connection.model('NewsArticle', newsArticleSchema)
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const articles = await NewsArticle.find()
      .populate('authorId', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
    return NextResponse.json(articles)
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 })
  }
}