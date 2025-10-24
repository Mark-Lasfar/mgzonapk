import { Document, Model, model, models, Schema, Types } from 'mongoose'

export interface INewsArticleInput {
  title: string
  slug: string
  excerpt: string
  content: string
  tags: string[]
  metaTitle: string
  metaDescription: string
  image: string
  isPublished: boolean
  isFeatured: boolean
  authorId?: string
  likes: number
  views: number
}

export interface INewsArticle extends Document, INewsArticleInput {
  _id: string
  createdAt: Date
  updatedAt: Date
}


export const newsArticleSchema = new Schema<INewsArticle>(
  {
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    excerpt: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    metaTitle: {
      type: String,
      required: true,
    },
    metaDescription: {
      type: String,
      required: true,
    },
    image: {
      type: String,
      default: 'https://mark-elasfar.web.app/assets/img/default-article.jpg',
    },
    isPublished: {
      type: Boolean,
      required: true,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'Author',
      required: true,
    },
    likes: {
      type: Number,
      default: 0,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
)

const NewsArticle =
  (models.NewsArticle as Model<INewsArticle>) ||
  model<INewsArticle>('NewsArticle', newsArticleSchema)

export default NewsArticle