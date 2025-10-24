'use server'

import { revalidatePath } from 'next/cache'
import { connectToDatabase } from '@/lib/db'
import NewsArticle, { INewsArticle } from '@/lib/db/models/news.model'
import Author from '@/lib/db/models/author.model'
import { formatError } from '@/lib/utils'
import { NewsArticleInputSchema, NewsArticleUpdateSchema } from '@/lib/validator'
import { z } from 'zod'
import { auth } from '@/auth'

export async function createNewsArticle(data: z.infer<typeof NewsArticleInputSchema>) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    await connectToDatabase()

    // Check if author exists, create if not
    let author = await Author.findOne({ userId: session.user.id })
    if (!author) {
      author = await Author.create({
        userId: session.user.id,
        name: session.user.name || 'Anonymous',
        bio: 'Author at MGZon AI',
        profileImageUrl: 'https://mark-elasfar.web.app/assets/img/default-avatar.png',
        socialLinks: {},
      })
    }

    const articleData = NewsArticleInputSchema.parse({
      ...data,
      authorId: author._id,
    })

    await NewsArticle.create(articleData)
    revalidatePath('/admin/news')
    return {
      success: true,
      message: 'News article created successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export async function updateNewsArticle(data: z.infer<typeof NewsArticleUpdateSchema>) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    await connectToDatabase()
    const articleData = NewsArticleUpdateSchema.parse(data)
    
    // Verify author exists
    const author = await Author.findById(articleData.authorId)
    if (!author) {
      throw new Error('Author not found')
    }

    await NewsArticle.findByIdAndUpdate(articleData._id, articleData)
    revalidatePath('/admin/news')
    return {
      success: true,
      message: 'News article updated successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export async function deleteNewsArticle(id: string) {
  try {
    await connectToDatabase()
    const res = await NewsArticle.findByIdAndDelete(id)
    if (!res) throw new Error('News article not found')
    revalidatePath('/admin/news')
    return {
      success: true,
      message: 'News article deleted successfully',
    }
  } catch (error) {
    return { success: false, message: formatError(error) }
  }
}

export async function getAllNewsArticles() {
  try {
    await connectToDatabase()
    const articles = await NewsArticle.find()
      .populate('authorId', 'name')
      .sort({ createdAt: -1 })
    return JSON.parse(JSON.stringify(articles)) as INewsArticle[]
  } catch (error) {
    throw new Error(`Failed to fetch articles: ${formatError(error)}`)
  }
}

export async function getNewsArticleById(articleId: string) {
  try {
    await connectToDatabase()
    const article = await NewsArticle.findById(articleId)
      .populate('authorId', 'name')
    if (!article) throw new Error('News article not found')
    return JSON.parse(JSON.stringify(article)) as INewsArticle
  } catch (error) {
    throw new Error(`Failed to fetch article: ${formatError(error)}`)
  }
}

export async function getNewsArticleBySlug(slug: string) {
  try {
    await connectToDatabase()
    const article = await NewsArticle.findOne({ slug, isPublished: true })
      .populate('authorId', 'name')
    if (!article) throw new Error('News article not found')
    return JSON.parse(JSON.stringify(article)) as INewsArticle
  } catch (error) {
    throw new Error(`Failed to fetch article: ${formatError(error)}`)
  }
}